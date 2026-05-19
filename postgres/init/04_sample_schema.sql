-- Sample table to demonstrate the API surface and RLS.
-- anon can SELECT; only callers with a valid JWT (role=authenticated) can INSERT.

-- We need an 'authenticated' role for the RLS policy to reference.
CREATE ROLE authenticated NOLOGIN NOINHERIT;
GRANT authenticated TO authenticator;
GRANT USAGE ON SCHEMA public TO authenticated;

CREATE TABLE public.todos (
	id         bigserial PRIMARY KEY,
	title      text NOT NULL,
	done       boolean NOT NULL DEFAULT false,
	created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can list todos.
CREATE POLICY todos_select_anon
	ON public.todos
	FOR SELECT
	TO anon, authenticated
	USING (true);

-- Authenticated insert only.
CREATE POLICY todos_insert_authenticated
	ON public.todos
	FOR INSERT
	TO authenticated
	WITH CHECK (true);

GRANT SELECT ON public.todos TO anon, authenticated;
GRANT INSERT ON public.todos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.todos_id_seq TO authenticated;

-- Seed a couple of rows so the API has something to return.
INSERT INTO public.todos (title, done) VALUES
	('Read the README', true),
	('Spin up the stack', false);
