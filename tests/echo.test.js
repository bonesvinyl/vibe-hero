import test from 'node:test';
import assert from 'node:assert/strict';
import { BonusEcho, VideoBonusEcho } from '../src/game/echo.js';
test('echo preserves the dry source and only opens the wet path during bonus', () => {
  const changes=[], connections=[];
  const parameter=()=>({value:0,cancelScheduledValues(){},setTargetAtTime(value){changes.push(value);}});
  const node=()=>({gain:parameter(),frequency:parameter(),delayTime:parameter(),connect(other){connections.push(other);},disconnect(){}});
  const context={currentTime:0,destination:{},createGain:node,createDelay:node,createBiquadFilter:node};
  const source=node(), echo=new BonusEcho(context,source);
  assert.equal(echo.input.gain.value,0); assert.equal(echo.output.gain.value,0);
  echo.set(true); assert.deepEqual(changes,[1,0.42]);
  echo.set(false); assert.deepEqual(changes.slice(-2),[0,0]);
  echo.destroy();
});
test('unavailable video capture fails without modifying or pausing the original video', async () => {
  let paused=false;
  const video={pause(){paused=true;},captureStream(){throw new Error('Cross-origin');}};
  assert.equal(await new VideoBonusEcho().attach(video),false); assert.equal(paused,false);
});
