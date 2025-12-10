import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://zynlhezlaxvolpptruiu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5bmxoZXpsYXh2b2xwcHRydWl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NjE1MDQsImV4cCI6MjA3ODMzNzUwNH0.G9ngWwqr3Hp_mTStHJIaY_rRS0AejrNmxFTwlxcsxEw'
);

async function checkSettings() {
  console.log('=== app_settings 테이블 조회 ===\n');

  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .eq('key', 'market_display_settings')
    .single();

  if (error) {
    console.log('에러:', error);
    return;
  }

  console.log('저장된 설정:');
  console.log(JSON.stringify(data, null, 2));

  if (data?.value) {
    console.log('\n=== 상세 내용 ===');
    console.log('market_order:', data.value.market_order);
    console.log('\ngrade_orders:', JSON.stringify(data.value.grade_orders, null, 2));
  }
}

checkSettings().catch(console.error);
