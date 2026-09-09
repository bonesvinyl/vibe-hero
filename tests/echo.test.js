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

test('bonus reverb generates a stereo decay response and connects it only through the wet output', () => {
  const nodes=[], parameter=()=>({value:0,cancelScheduledValues(){},setTargetAtTime(){}});
  const node=()=>{const n={gain:parameter(),frequency:parameter(),delayTime:parameter(),targets:[],connect(other){this.targets.push(other);},disconnect(){this.disconnected=true;}};nodes.push(n);return n;};
  const context={sampleRate:100,currentTime:0,destination:{},createGain:node,createDelay:node,createBiquadFilter:node,createConvolver:node,
    createBuffer(channels,length){const data=Array.from({length:channels},()=>new Float32Array(length));return {data,getChannelData:i=>data[i]};}};
  const echo=new BonusEcho(context,node()), [convolver,gain]=echo.reverbNodes;
  assert.equal(convolver.buffer.data.length,2); assert.equal(convolver.buffer.data[0].length,260);
  assert.ok(convolver.buffer.data[0].some(n=>n!==0));
  assert.deepEqual(gain.targets,[echo.output]); assert.equal(echo.output.gain.value,0);
  echo.destroy(); assert.equal(convolver.disconnected,true);
});
