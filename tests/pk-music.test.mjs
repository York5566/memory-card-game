import test from 'node:test';
import assert from 'node:assert/strict';
import {composeLoop,createPKMusic} from '../public/js/pk-music.js';
test('original music loop is finite, quiet, seamless and has audible content',()=>{
 const samples=composeLoop();let peak=0,sum=0;for(const x of samples){assert.ok(Number.isFinite(x));peak=Math.max(peak,Math.abs(x));sum+=x*x;}
 assert.ok(peak<.4);assert.ok(sum/samples.length>.0001);assert.equal(samples[0],0);assert.equal(samples.at(-1),0);assert.equal(samples.length,441000);
});
test('music starts after unlock, ducks for effects, mutes in background and never overlaps loops',async()=>{
 const sources=[],ramps=[];let context;
 class Context {
  constructor(){context=this;this.currentTime=1;this.state='suspended';this.destination={};}
  async resume(){this.state='running';}
  createGain(){return {connect(){},gain:{setValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(...args){ramps.push(args);}}};}
  createBuffer(){return {copyToChannel(){}};}
  createBufferSource(){const source={connect(){},start(){this.started=true;},stop(){this.stopped=true;},disconnect(){}};sources.push(source);return source;}
 }
 const music=createPKMusic({Context});music.setPhase('waiting');assert.equal(sources.length,0);
 assert.equal(await music.unlock(),true);assert.equal(sources.length,1);assert.equal(sources[0].loop,true);
 music.setPhase('playing');await music.unlock();assert.equal(sources.length,1);music.duck();assert.equal(ramps.at(-2)[0],.025);assert.equal(ramps.at(-1)[0],.1);
 music.setVisible(false);assert.equal(sources[0].stopped,true);music.setVisible(true);assert.equal(sources.length,2);
 music.setEnabled(false);assert.equal(sources[1].stopped,true);music.setPhase('waiting');assert.equal(sources.length,2);
 music.setEnabled(true);assert.equal(sources.length,3);music.stop();assert.equal(sources[2].stopped,true);assert.ok(context);
});
test('unsupported audio does not prevent gameplay',async()=>{
 const music=createPKMusic({Context:null});music.setPhase('waiting');assert.equal(await music.unlock(),false);music.duck();music.stop();
});
