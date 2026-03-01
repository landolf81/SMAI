-- 신규 가입 회원 환영 DM 자동 발송 트리거
-- 새 사용자가 users 테이블에 INSERT될 때 super_admin → 신규 회원으로 DM 발송

CREATE OR REPLACE FUNCTION send_welcome_dm()
RETURNS TRIGGER AS $$
DECLARE
  admin_id UUID;
  welcome_msg TEXT;
BEGIN
  -- super_admin 계정 중 첫 번째를 발신자로 사용
  SELECT ar.user_id INTO admin_id
  FROM admin_roles ar
  WHERE ar.role = 'super_admin'
  ORDER BY ar.created_at ASC
  LIMIT 1;

  -- super_admin이 없으면 DM 생략
  IF admin_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 자기 자신에게는 발송하지 않음
  IF admin_id = NEW.id THEN
    RETURN NEW;
  END IF;

  welcome_msg := '참외이야기에 오신 것을 환영합니다! 🍈' || chr(10) || chr(10) ||
    '성주군 농업인들이 함께 만들어가는 커뮤니티입니다.' || chr(10) ||
    '영농 정보 공유, 질문, 중고거래 등 편하게 이용해주세요.' || chr(10) || chr(10) ||
    '즐거운 참외 농사 되시길 바랍니다!';

  INSERT INTO messages (sender_id, receiver_id, content, is_read, created_at, updated_at)
  VALUES (admin_id, NEW.id, welcome_msg, false, NOW(), NOW());

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- DM 발송 실패해도 회원가입은 정상 진행
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 트리거가 있으면 삭제 후 재생성
DROP TRIGGER IF EXISTS on_new_user_welcome_dm ON users;

CREATE TRIGGER on_new_user_welcome_dm
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION send_welcome_dm();
