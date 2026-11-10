-- Minimal ROX boundary fixture for isolated PostgreSQL tests. Not a migration.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
CREATE TYPE public.app_role AS ENUM('master','auftraggeber','durchfuehrer');
CREATE TYPE public.order_type AS ENUM('customer','production','rnd','internal');
CREATE TYPE public.measurement_status AS ENUM('open','in_progress','completed');
CREATE TYPE public.order_status AS ENUM('open','in_progress','completed');
CREATE TYPE public.order_kind AS ENUM('legacy','labor','pilot_plant','combined');
CREATE TYPE public.workflow_status AS ENUM('entwurf','abgeschlossen');
CREATE TABLE public.profiles(user_id uuid PRIMARY KEY,first_name text,last_name text,short_code text,is_active boolean);
CREATE TABLE public.user_roles(user_id uuid,role public.app_role);
CREATE TABLE public.role_permissions(user_id uuid,permission_key text);
CREATE TABLE public.mdl_service_permissions(user_id uuid,service_id uuid);
CREATE TABLE public.measurement_services(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),service_name text,category text,active boolean DEFAULT true,archived_at timestamptz);
CREATE TABLE public.measurement_orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_type public.order_type NOT NULL,created_by uuid NOT NULL,order_kind public.order_kind DEFAULT 'legacy',due_date date,notes text,reference_number text,order_number text,shared_form_data jsonb DEFAULT '{}',status public.order_status DEFAULT 'open',workflow_status public.workflow_status,sample_id uuid,project_id uuid,is_billed boolean DEFAULT false);
CREATE TABLE public.order_measurements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid REFERENCES public.measurement_orders(id) ON DELETE CASCADE,service_id uuid,assigned_to uuid,measurement_number text,status public.measurement_status DEFAULT 'open',due_date date,sample_id uuid,origin text DEFAULT 'booked');
CREATE TABLE public.measurement_results(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_measurement_id uuid REFERENCES public.order_measurements(id),result_name text);
CREATE TABLE public.order_reports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid UNIQUE REFERENCES public.measurement_orders(id),auto_generated boolean);
CREATE TABLE public.activity_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_type text,actor_user_id uuid,order_id uuid REFERENCES public.measurement_orders(id) ON DELETE CASCADE,order_measurement_id uuid REFERENCES public.order_measurements(id) ON DELETE CASCADE,metadata jsonb,created_at timestamptz DEFAULT now());
CREATE FUNCTION public.has_role(u uuid,r public.app_role) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=u AND role=r) $$;
CREATE FUNCTION public.has_permission(u uuid,p text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.role_permissions WHERE user_id=u AND permission_key=p) $$;
CREATE FUNCTION public.is_external_customer(u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.role_permissions WHERE user_id=u AND permission_key='external') $$;
-- Existing unrelated workflow engines are not under test. Failure would show unintended expansion.
CREATE FUNCTION public.bootstrap_order_workflow(u uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Customer workflow invoked for internal check'; END $$;
CREATE FUNCTION public.expand_service_workflow(u uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Customer expansion invoked for internal check'; END $$;
CREATE FUNCTION public.recompute_order_workflow_status(u uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Customer workflow recompute invoked'; END $$;
CREATE FUNCTION public.fixture_sync_status() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE public.measurement_orders SET status=NEW.status::text::public.order_status WHERE id=NEW.order_id; RETURN NEW; END $$;
CREATE TRIGGER fixture_sync_status AFTER UPDATE OF status ON public.order_measurements FOR EACH ROW EXECUTE FUNCTION public.fixture_sync_status();