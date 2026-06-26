
-- Document kind enum
CREATE TYPE public.project_document_kind AS ENUM ('application', 'report');

-- Unified project documents table (application + reports, with versions)
CREATE TABLE public.project_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  doc_kind public.project_document_kind NOT NULL,
  version_major int NOT NULL DEFAULT 1,
  version_minor int NOT NULL DEFAULT 0,
  version_label text GENERATED ALWAYS AS (version_major::text || '.' || version_minor::text) STORED,
  file_name text NOT NULL,
  file_type text,
  file_size bigint,
  storage_path text NOT NULL,
  change_comment text,
  is_current boolean NOT NULL DEFAULT true,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_documents_project_kind ON public.project_documents(project_id, doc_kind, is_current);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_documents TO authenticated;
GRANT ALL ON public.project_documents TO service_role;

ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

-- Read: project members, master, or anyone with projects.view permission
CREATE POLICY "project_documents_select" ON public.project_documents
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'master'::app_role)
  OR public.is_project_member(auth.uid(), project_id)
  OR public.has_permission(auth.uid(), 'projects.view')
);

-- Insert/Update/Delete: master, project owner/leader, or projects.edit
CREATE POLICY "project_documents_insert" ON public.project_documents
FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid() AND (
    public.has_role(auth.uid(), 'master'::app_role)
    OR public.has_project_role(auth.uid(), project_id, 'owner'::project_role)
    OR public.has_project_role(auth.uid(), project_id, 'leader'::project_role)
    OR public.has_permission(auth.uid(), 'projects.edit')
  )
);

CREATE POLICY "project_documents_update" ON public.project_documents
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'master'::app_role)
  OR public.has_project_role(auth.uid(), project_id, 'owner'::project_role)
  OR public.has_project_role(auth.uid(), project_id, 'leader'::project_role)
  OR public.has_permission(auth.uid(), 'projects.edit')
);

CREATE POLICY "project_documents_delete" ON public.project_documents
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'master'::app_role)
  OR public.has_project_role(auth.uid(), project_id, 'owner'::project_role)
  OR public.has_project_role(auth.uid(), project_id, 'leader'::project_role)
  OR public.has_permission(auth.uid(), 'projects.edit')
);

-- RPC: upload a new project document version
-- Marks previous current of (project, kind) as archived, computes next version
CREATE OR REPLACE FUNCTION public.add_project_document(
  _project_id uuid,
  _doc_kind public.project_document_kind,
  _file_name text,
  _file_type text,
  _file_size bigint,
  _storage_path text,
  _bump_major boolean DEFAULT false,
  _change_comment text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_prev RECORD;
  v_major int := 1;
  v_minor int := 0;
  v_id uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentifizierung erforderlich'; END IF;
  IF NOT (
    has_role(v_actor, 'master'::app_role)
    OR has_project_role(v_actor, _project_id, 'owner'::project_role)
    OR has_project_role(v_actor, _project_id, 'leader'::project_role)
    OR has_permission(v_actor, 'projects.edit')
  ) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Hochladen von Projektdokumenten';
  END IF;

  SELECT version_major, version_minor INTO v_prev
  FROM project_documents
  WHERE project_id = _project_id AND doc_kind = _doc_kind AND is_current = true
  LIMIT 1;

  IF FOUND THEN
    IF _doc_kind = 'application' THEN
      v_major := v_prev.version_major + 1;
      v_minor := 0;
    ELSIF _bump_major THEN
      v_major := v_prev.version_major + 1;
      v_minor := 0;
    ELSE
      v_major := v_prev.version_major;
      v_minor := v_prev.version_minor + 1;
    END IF;
  END IF;

  UPDATE project_documents
     SET is_current = false
   WHERE project_id = _project_id AND doc_kind = _doc_kind AND is_current = true;

  INSERT INTO project_documents(project_id, doc_kind, version_major, version_minor,
    file_name, file_type, file_size, storage_path, change_comment, is_current, uploaded_by)
  VALUES (_project_id, _doc_kind, v_major, v_minor,
    _file_name, _file_type, _file_size, _storage_path, _change_comment, true, v_actor)
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

-- Storage policies for bucket 'project-documents'
CREATE POLICY "project_docs_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'project-documents' AND (
    public.has_role(auth.uid(), 'master'::app_role)
    OR public.has_permission(auth.uid(), 'projects.view')
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
        AND pm.project_id::text = split_part(storage.objects.name, '/', 1)
    )
  )
);

CREATE POLICY "project_docs_write" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'project-documents' AND (
    public.has_role(auth.uid(), 'master'::app_role)
    OR public.has_permission(auth.uid(), 'projects.edit')
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
        AND pm.role IN ('owner','leader')
        AND pm.project_id::text = split_part(storage.objects.name, '/', 1)
    )
  )
);

CREATE POLICY "project_docs_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'project-documents' AND (
    public.has_role(auth.uid(), 'master'::app_role)
    OR public.has_permission(auth.uid(), 'projects.edit')
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.user_id = auth.uid()
        AND pm.role IN ('owner','leader')
        AND pm.project_id::text = split_part(storage.objects.name, '/', 1)
    )
  )
);
