import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTime, formatTime, parseSubtitles, parseCuts, applyCuts, serializeSubtitles, retime } from '../core/timeline.mjs';
const srt = (start = '00:00:05,000', end = '00:00:15,000', text = 'Keep the words.') => `1\n${start} --> ${end}\n${text}\n`;

test('timestamps round-trip exactly at millisecond boundaries', () => {
  for (const ms of [0,1,999,1000,59999,60000,3600000,35_999_999_999]) assert.equal(parseTime(formatTime(ms)), ms);
  assert.equal(parseTime('1:02.3'), 62300);
  for (const text of ['-1','1e3','00:60:00','1:00:60','1.0001','', 'Infinity']) assert.throws(() => parseTime(text));
});
test('SRT preserves BOM, CRLF, multiline text and literal markup', () => {
  const doc = parseSubtitles('\uFEFF' + srt(undefined, undefined, '<b>Hello</b>\n你好').replaceAll('\n', '\r\n'));
  assert.equal(doc.cues[0].text, '<b>Hello</b>\n你好');
  assert.equal(doc.format, 'srt');
});
test('malformed and reversed cues fail instead of being dropped', () => {
  for (const text of ['', 'not subtitles', srt('00:00:15,000','00:00:05,000'), srt(undefined,undefined,''), srt()+'\n2\nbroken\nwords', '\0']) assert.throws(()=>parseSubtitles(text));
});
test('WebVTT keeps cue IDs, settings and metadata', () => {
  const raw = 'WEBVTT\n\nNOTE editor\nPreserve this note\n\ncaption-a\n00:05.000 --> 00:15.000 align:start position:10%\n<v Mei>Hello';
  const doc = retime(raw, '0 --> 2');
  const exported = serializeSubtitles(doc);
  assert.match(exported,/NOTE editor/);
  assert.match(exported,/caption-a\n00:00:03.000 --> 00:00:13.000 align:start position:10%/);
  assert.equal(parseSubtitles(exported).cues[0].text,'<v Mei>Hello');
});
test('karaoke timestamps and external timestamp maps are rejected',()=>{
  assert.throws(()=>parseSubtitles('WEBVTT\n\n00:00.000 --> 00:02.000\n<00:01.000>hello'),/karaoke/);
  assert.throws(()=>parseSubtitles('WEBVTT\nX-TIMESTAMP-MAP=LOCAL:00:00:00.000,MPEGTS:0\n\n00:00.000 --> 00:02.000\nhello'),/timestamp maps/);
});
test('cuts merge overlaps and touching ranges without double subtraction', () => {
  assert.deepEqual(parseCuts('start,end\n8,12\n2,5\n4,9\n12,13'), [{start:2000,end:13000}]);
  assert.deepEqual(parseCuts('# comment\n'),[]);
  assert.throws(()=>parseCuts('5 --> 4'));
  assert.throws(()=>parseCuts('1,2,3'));
});
test('cuts use half-open boundaries: ending at a cut is unchanged',()=>{
  const doc = retime(srt('00:00:00,000','00:00:05,000'),'5 --> 8');
  assert.equal(doc.changes[0].status,'unchanged');
  assert.equal(doc.cues[0].end,5000);
});
test('a cue starting at a cut end shifts, but is not trimmed',()=>{
  const doc=retime(srt('00:00:08,000','00:00:10,000'),'5 --> 8');
  assert.equal(doc.changes[0].status,'shifted');
  assert.deepEqual([doc.cues[0].start,doc.cues[0].end],[5000,7000]);
});
test('fully deleted cues disappear; edge overlap trims; internal overlap splits',()=>{
  assert.equal(retime(srt(),'0 --> 20').cues.length,0);
  assert.equal(retime(srt(),'0 --> 8').changes[0].status,'trimmed');
  const doc=retime(srt(),'8 --> 12');
  assert.equal(doc.changes[0].status,'split');
  assert.deepEqual(doc.cues.map(c=>[c.start,c.end]),[[5000,8000],[8000,11000]]);
});
test('several cuts ripple without accumulated rounding errors',()=>{
  const doc=retime(srt('00:00:20,001','00:00:25,001'),'0.001 --> 0.002\n1.000 --> 2.001\n8 --> 9');
  assert.equal(doc.cues[0].start,17999);
  assert.equal(doc.cues[0].end,22999);
  assert.equal(doc.removedMs,2002);
});
test('no cuts preserve cue timings; exporting renumbers split SRT cues',()=>{
  const doc=retime(srt(),'');
  assert.equal(serializeSubtitles(doc),srt());
  const result=serializeSubtitles(retime(srt(),'8 --> 12'));
  assert.equal(parseSubtitles(result).cues.length,2);
  assert.match(result,/\n\n2\n/);
});
test('bounded fixtures agree with a brute-force retained-millisecond oracle',()=>{
  for(let a=0;a<20;a++) for(let b=a+1;b<=20;b++) {
    const cuts=parseCuts('0.003 --> 0.007\n0.010 --> 0.014');
    const input={format:'srt',header:'',metadata:[],cues:[{index:1,id:'1',start:a,end:b,text:'x',settings:''}]};
    const out=applyCuts(input,cuts);
    const expected=Array.from({length:b-a},(_,i)=>a+i).filter(t=>!cuts.some(c=>c.start<=t&&t<c.end)).length;
    assert.equal(out.cues.reduce((n,c)=>n+c.end-c.start,0),expected);
    assert.ok(out.cues.every(c=>c.start>=0&&c.end>c.start));
  }
});
