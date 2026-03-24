-- badge_types 테이블에 관리자 INSERT/UPDATE/DELETE 정책 추가
-- 기존에 SELECT 정책만 있어서 관리자가 뱃지 타입 수정 불가했음
-- admin_roles 테이블 참조 (users.role 컬럼은 존재하지 않음)

CREATE POLICY "badge_types_admin_insert" ON badge_types
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE admin_roles.user_id = auth.uid()
      AND admin_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "badge_types_admin_update" ON badge_types
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE admin_roles.user_id = auth.uid()
      AND admin_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "badge_types_admin_delete" ON badge_types
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE admin_roles.user_id = auth.uid()
      AND admin_roles.role IN ('admin', 'super_admin')
    )
  );
