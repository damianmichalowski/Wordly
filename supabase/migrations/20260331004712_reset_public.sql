-- ⚠️ HARD RESET PUBLIC SCHEMA (DEV ONLY)

SET session_replication_role = replica;

-- drop tables
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    )
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;

-- drop sequences
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'
    )
    LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.sequence_name) || ' CASCADE';
    END LOOP;
END $$;

-- drop functions
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT
            p.proname as routine_name,
            pg_get_function_identity_arguments(p.oid) as identity_arguments
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
    )
    LOOP
        EXECUTE
            'DROP FUNCTION IF EXISTS public.'
            || quote_ident(r.routine_name)
            || '('
            || r.identity_arguments
            || ') CASCADE';
    END LOOP;
END $$;

-- drop types
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT typname
        FROM pg_type
        WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
          AND typtype IN ('e', 'c', 'd')
    )
    LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
    END LOOP;
END $$;

SET session_replication_role = DEFAULT;