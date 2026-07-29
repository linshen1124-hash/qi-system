-- ============================================================
-- QI SYSTEM · 启用行级安全（RLS）
--
-- 背景：migration.sql 第 20 节当初按"内网单机"关掉了全部 RLS，
--       但系统已经部署到公网，anon key 又公开写在前端 JS 里，
--       等于任何人都能读写全部业务表。这份脚本把这个口子堵上。
--
-- 策略：登录用户（authenticated）保持完全读写，未登录（anon）一律拒绝。
--       不做更细的按人分权——当前是同一科室共用，先解决"对外敞开"。
--
-- ⚠️ 执行顺序要求：必须先把带登录功能的前端部署上线，再跑这份脚本。
--    反过来跑会让线上立刻全部报错（老前端不带登录态，会被 RLS 拒绝）。
--
-- 执行方式：Supabase SQL Editor 整份粘贴运行。可重复执行，幂等。
-- ============================================================

-- ---------- 1. 业务表：启用 RLS + 放行已登录用户 ----------
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS qi_authenticated_all ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY qi_authenticated_all ON public.%I '
            'FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    END LOOP;
END;
$$;

-- ---------- 2. 收回 anon 的表权限（RLS 之外再加一道） ----------
-- 存储函数都是默认的 SECURITY INVOKER，会跟着调用者身份走，
-- 所以表权限一收，anon 调 RPC 也拿不到数据，不用逐个函数改。
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

-- 确保登录用户该有的权限没被上面误伤
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES     IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES  IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;

-- ---------- 3. 附件存储桶私有化 ----------
-- 原本 attachments 桶是公开的，前端用 getPublicUrl 拿永久链接，
-- 意味着扫描件（合同、证件、名册）只要 URL 泄露就人人可看。
-- 改成私有桶 + 一小时有效的签名链接（前端 app.js 已同步改用 createSignedUrl）。
--
-- 注：storage 这一节的表归 supabase_storage_admin 所有，SQL Editor 里偶尔会报权限不足。
-- 真报错的话，改用面板操作，效果一样：
--   桶私有化 → Storage → attachments → Configuration，取消勾选 Public bucket
--   四条策略 → Storage → Policies → attachments，各建一条 authenticated 的 SELECT/INSERT/UPDATE/DELETE
UPDATE storage.buckets SET public = false WHERE id = 'attachments';

DROP POLICY IF EXISTS qi_attach_read   ON storage.objects;
DROP POLICY IF EXISTS qi_attach_write  ON storage.objects;
DROP POLICY IF EXISTS qi_attach_update ON storage.objects;
DROP POLICY IF EXISTS qi_attach_delete ON storage.objects;

CREATE POLICY qi_attach_read ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'attachments');
CREATE POLICY qi_attach_write ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments');
CREATE POLICY qi_attach_update ON storage.objects
    FOR UPDATE TO authenticated USING (bucket_id = 'attachments');
CREATE POLICY qi_attach_delete ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'attachments');

-- ---------- 4. 自检：跑完看一眼结果 ----------
-- 期望：rls_enabled 全为 true，policy_count 全为 1
SELECT c.relname            AS table_name,
       c.relrowsecurity     AS rls_enabled,
       count(p.polname)     AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public' AND c.relkind = 'r'
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relrowsecurity, c.relname;
