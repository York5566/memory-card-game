import test from 'node:test';
import assert from 'node:assert/strict';
import { GUIDE_KEY, GUIDE_STEPS, guideSeen, markGuideSeen } from '../public/js/tutorial.js';
import { verificationError, invitationError } from '../public/js/verification.js';
import { t } from '../public/js/i18n.js';
import { resultOutcome } from '../public/js/pk-presentation.js';

test('對方在準備期間離開不顯示勝負；已開始的對局保留勝平負', () => {
  assert.equal(resultOutcome({startedAt:0,winner:0,seat:0}),'cancelled');
  for(const [winner,expected] of [[0,'win'],[1,'loss'],[null,'draw']]) assert.equal(resultOutcome({startedAt:1000,winner,seat:0}),expected);
});

test('教學完成或跳過只寫自己的旗標，不動遊戲資料；儲存受限也不拋錯', () => {
  const data = new Map([['settings', 'keep']]);
  const storage = { getItem: key => data.get(key), setItem: (key,value) => data.set(key,value) };
  assert.equal(guideSeen(storage),false); markGuideSeen(storage); assert.equal(guideSeen(storage),true);
  assert.equal(data.get('settings'),'keep'); assert.deepEqual([...data.keys()],['settings',GUIDE_KEY]);
  const denied = { getItem(){ throw Error('blocked'); }, setItem(){ throw Error('blocked'); } };
  assert.equal(guideSeen(denied),false); assert.doesNotThrow(()=>markGuideSeen(denied));
});
test('教學與邀請失敗引導涵蓋四種語言，雲端保存與一般錯誤不誤導重新邀請', () => {
  for(const lang of ['zh-Hant','en','ja','ko']) {
    for(const step of GUIDE_STEPS) for(const text of step) { assert.ok(t(text,lang)); if(lang!=='zh-Hant')assert.notEqual(t(text,lang),text); }
    const error=verificationError(t('驗證未完成，請再試一次。',lang));
    const joining=invitationError(error,true,key=>t(key,lang));
    assert.ok(joining.length>error.message.length);
    if(lang!=='zh-Hant')assert.ok(!joining.includes('若重試'));
    assert.equal(invitationError(error,false,t),error.message);
    assert.equal(invitationError(Error('offline'),true,t),'offline');
  }
});
