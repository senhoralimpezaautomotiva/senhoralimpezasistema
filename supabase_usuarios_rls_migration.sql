-- Corrige exclusivamente as políticas RLS de public.usuarios.
-- Não recria a tabela, não altera auth.users e não cria usuários.

BEGIN;

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios NO FORCE ROW LEVEL SECURITY;

-- Elimina todas as políticas existentes da tabela, inclusive políticas com
-- subconsultas recursivas a public.usuarios.
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'usuarios'
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON public.usuarios',
            policy_record.policyname
        );
    END LOOP;
END $$;

-- SECURITY DEFINER evita que a verificação administrativa reentre nas
-- políticas RLS de public.usuarios. Sem argumentos, a função só pode avaliar
-- o usuário autenticado da sessão atual.
CREATE OR REPLACE FUNCTION public.is_active_usuario_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.usuarios AS u
        WHERE u.auth_user_id = (SELECT auth.uid())
          AND u.perfil = 'admin'
          AND u.status = 'ativo'
    );
$$;

REVOKE ALL ON FUNCTION public.is_active_usuario_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_usuario_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_active_usuario_admin() TO authenticated;

-- Todo usuário autenticado pode ler somente o próprio perfil. Um
-- administrador ativo pode ler os demais perfis para gerenciar usuários.
CREATE POLICY "usuarios_select_own_or_admin"
ON public.usuarios
FOR SELECT
TO authenticated
USING (
    auth_user_id = (SELECT auth.uid())
    OR (SELECT public.is_active_usuario_admin())
);

-- Escritas são administrativas. Não é concedido UPDATE do próprio registro
-- a usuários comuns, pois isso permitiria alterar perfil/status pela API.
CREATE POLICY "usuarios_insert_admin"
ON public.usuarios
FOR INSERT
TO authenticated
WITH CHECK ((SELECT public.is_active_usuario_admin()));

CREATE POLICY "usuarios_update_admin"
ON public.usuarios
FOR UPDATE
TO authenticated
USING ((SELECT public.is_active_usuario_admin()))
WITH CHECK ((SELECT public.is_active_usuario_admin()));

CREATE POLICY "usuarios_delete_admin"
ON public.usuarios
FOR DELETE
TO authenticated
USING ((SELECT public.is_active_usuario_admin()));

COMMIT;
