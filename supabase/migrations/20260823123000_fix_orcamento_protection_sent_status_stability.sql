-- Permite atualizacoes legitimas que mantem orcamento enviado como enviado.
-- Preserva a protecao contra regressao real para rascunho.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_proteger_orcamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status <> 'rascunho' THEN
            RAISE EXCEPTION 'Somente orcamentos em rascunho podem ser excluidos';
        END IF;
        RETURN OLD;
    END IF;

    IF OLD.status <> 'rascunho' AND (
        NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
        OR (
            NEW.veiculo_id IS DISTINCT FROM OLD.veiculo_id
            AND NOT (OLD.veiculo_id IS NOT NULL AND NEW.veiculo_id IS NULL)
        )
        OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
        OR NEW.desconto IS DISTINCT FROM OLD.desconto
        OR NEW.total IS DISTINCT FROM OLD.total
        OR NEW.validade IS DISTINCT FROM OLD.validade
        OR NEW.observacoes IS DISTINCT FROM OLD.observacoes
    ) THEN
        RAISE EXCEPTION 'O conteudo de um orcamento enviado e imutavel';
    END IF;
    IF OLD.status <> 'rascunho' AND NEW.status = 'rascunho' THEN
        RAISE EXCEPTION 'Um orcamento enviado nao pode voltar ao estado inicial';
    END IF;
    IF OLD.status NOT IN ('rascunho', 'enviado') AND NEW.status <> OLD.status THEN
        RAISE EXCEPTION 'Um orcamento encerrado nao pode mudar de estado';
    END IF;

    IF OLD.status = 'rascunho' AND NEW.status = 'enviado' THEN
        NEW.sent_at := coalesce(NEW.sent_at, now());
    ELSIF NEW.status = 'rascunho' THEN
        NEW.sent_at := NULL;
    ELSE
        NEW.sent_at := coalesce(NEW.sent_at, OLD.sent_at);
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

COMMIT;
