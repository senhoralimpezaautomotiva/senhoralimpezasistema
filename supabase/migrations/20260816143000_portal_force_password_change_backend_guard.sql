BEGIN;

CREATE OR REPLACE FUNCTION public.portal_password_change_required()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce((auth.jwt() -> 'app_metadata' ->> 'force_password_change')::boolean, false)
      OR coalesce((auth.jwt() -> 'user_metadata' ->> 'force_password_change')::boolean, false)
$$;

CREATE OR REPLACE FUNCTION public.portal_password_change_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND NOT public.portal_password_change_required()
$$;

REVOKE ALL ON FUNCTION public.portal_password_change_required() FROM public, anon;
REVOKE ALL ON FUNCTION public.portal_password_change_allowed() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.portal_password_change_required() TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_password_change_allowed() TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_current_cliente_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT identity_row.cliente_id
  FROM public.portal_client_identities AS identity_row
  WHERE identity_row.auth_user_id = auth.uid()
    AND public.portal_password_change_allowed()
$$;

CREATE OR REPLACE FUNCTION public.portal_resolve_auth_identity()
RETURNS TABLE (provider text, identity_value text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_auth_user auth.users%rowtype;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'AUTH_REQUIRED';
  END IF;

  IF public.portal_password_change_required() THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'PASSWORD_CHANGE_REQUIRED';
  END IF;

  SELECT *
  INTO current_auth_user
  FROM auth.users
  WHERE id = auth.uid();

  IF current_auth_user.email IS NOT NULL
     AND current_auth_user.email_confirmed_at IS NOT NULL THEN
    provider := 'email';
    identity_value := lower(trim(current_auth_user.email));
    RETURN NEXT;
    RETURN;
  END IF;

  IF current_auth_user.phone IS NOT NULL
     AND current_auth_user.phone_confirmed_at IS NOT NULL THEN
    provider := 'phone';
    identity_value := public.portal_normalize_phone(current_auth_user.phone);
    RETURN NEXT;
    RETURN;
  END IF;

  RAISE EXCEPTION USING errcode = '42501', message = 'IDENTITY_NOT_VERIFIED';
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_busy_intervals(p_date date)
RETURNS TABLE (hora_agendamento time, tempo_estimado_minutos integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.portal_password_change_required() THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'PASSWORD_CHANGE_REQUIRED';
  END IF;

  RETURN QUERY
  SELECT a.hora_agendamento, greatest(coalesce(a.tempo_real, 60), 1)
  FROM public.agendamentos AS a
  WHERE a.data_agendamento = p_date
    AND a.status <> 'Cancelado'
    AND p_date BETWEEN current_date AND (current_date + 90);
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_referral_progress()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_cliente_id uuid;
  progress integer;
BEGIN
  IF public.portal_password_change_required() THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'PASSWORD_CHANGE_REQUIRED';
  END IF;

  current_cliente_id := public.portal_current_cliente_id();
  IF current_cliente_id IS NULL THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'CUSTOMER_LINK_REQUIRED';
  END IF;

  SELECT greatest(0, coalesce(sum(entry.delta), 0))::integer
  INTO progress
  FROM public.loyalty_card_entries entry
  WHERE entry.customer_id = current_cliente_id;

  RETURN coalesce(progress, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_validate_referral_code(p_code text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.portal_password_change_required() THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'PASSWORD_CHANGE_REQUIRED';
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.clientes
    WHERE upper(public.portal_customer_metadata(nome)->>'referralCode') =
      upper(regexp_replace(trim(coalesce(p_code, '')), '[^a-zA-Z0-9-]', '', 'g'))
      AND nullif(upper(regexp_replace(trim(coalesce(p_code, '')), '[^a-zA-Z0-9-]', '', 'g')), '') IS NOT NULL
      AND id IS DISTINCT FROM public.portal_current_cliente_id()
  );
END;
$$;

DROP POLICY IF EXISTS portal_identity_select_own ON public.portal_client_identities;
CREATE POLICY portal_identity_select_own
ON public.portal_client_identities
FOR SELECT
TO authenticated
USING (
  public.portal_is_active_staff()
  OR (auth_user_id = auth.uid() AND public.portal_password_change_allowed())
);

DROP POLICY IF EXISTS clientes_portal_select_own ON public.clientes;
CREATE POLICY clientes_portal_select_own
ON public.clientes
FOR SELECT
TO authenticated
USING (id = public.portal_current_cliente_id());

DROP POLICY IF EXISTS veiculos_portal_select_own ON public.veiculos;
CREATE POLICY veiculos_portal_select_own
ON public.veiculos
FOR SELECT
TO authenticated
USING (cliente_id = public.portal_current_cliente_id());

DROP POLICY IF EXISTS veiculos_portal_insert_own ON public.veiculos;
CREATE POLICY veiculos_portal_insert_own
ON public.veiculos
FOR INSERT
TO authenticated
WITH CHECK (cliente_id = public.portal_current_cliente_id());

DROP POLICY IF EXISTS veiculos_portal_update_own ON public.veiculos;
CREATE POLICY veiculos_portal_update_own
ON public.veiculos
FOR UPDATE
TO authenticated
USING (cliente_id = public.portal_current_cliente_id())
WITH CHECK (cliente_id = public.portal_current_cliente_id());

DROP POLICY IF EXISTS agendamentos_portal_select_own ON public.agendamentos;
CREATE POLICY agendamentos_portal_select_own
ON public.agendamentos
FOR SELECT
TO authenticated
USING (cliente_id = public.portal_current_cliente_id());

DROP POLICY IF EXISTS servicos_catalog_read ON public.servicos_disponiveis;
CREATE POLICY servicos_catalog_read
ON public.servicos_disponiveis
FOR SELECT
TO anon, authenticated
USING (auth.uid() IS NULL OR (coalesce(ativo, true) AND public.portal_password_change_allowed()));

DROP POLICY IF EXISTS servicos_precos_catalog_read ON public.servicos_precos;
CREATE POLICY servicos_precos_catalog_read
ON public.servicos_precos
FOR SELECT
TO anon, authenticated
USING (auth.uid() IS NULL OR public.portal_password_change_allowed());

DROP POLICY IF EXISTS marcas_catalog_read ON public.marcas_veiculos;
CREATE POLICY marcas_catalog_read
ON public.marcas_veiculos
FOR SELECT
TO anon, authenticated
USING (auth.uid() IS NULL OR (coalesce(ativo, true) AND public.portal_password_change_allowed()));

DROP POLICY IF EXISTS modelos_catalog_read ON public.modelos_veiculos;
CREATE POLICY modelos_catalog_read
ON public.modelos_veiculos
FOR SELECT
TO anon, authenticated
USING (auth.uid() IS NULL OR (coalesce(ativo, true) AND public.portal_password_change_allowed()));

DROP POLICY IF EXISTS configuracoes_empresa_select_public ON public.configuracoes_empresa;
CREATE POLICY configuracoes_empresa_select_public
ON public.configuracoes_empresa
FOR SELECT
TO anon, authenticated
USING (auth.uid() IS NULL OR public.portal_password_change_allowed() OR public.portal_is_active_staff());

COMMIT;
