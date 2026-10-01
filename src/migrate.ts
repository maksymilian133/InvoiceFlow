import pool from './db';

export async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      status      VARCHAR(20)   NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','processing','done','needs_review','rejected')),
      raw_text    TEXT          NOT NULL,
      filename    VARCHAR(255),
      extracted   JSONB,
      erp_ref     VARCHAR(100),
      error_msg   TEXT,
      created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );

    -- Dodaj kolumny jeśli tabela już istniała bez nich
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS filename     VARCHAR(255);
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS erp_ref      VARCHAR(100);
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS error_msg    TEXT;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);

    CREATE UNIQUE INDEX IF NOT EXISTS invoices_content_hash_uidx
      ON invoices (content_hash) WHERE content_hash IS NOT NULL;

    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS invoices_updated_at ON invoices;
    CREATE TRIGGER invoices_updated_at
      BEFORE UPDATE ON invoices
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
  console.log('[migrate] Tabela invoices gotowa.');
}
