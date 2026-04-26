// Stitches all 7 scenes back-to-back into one 180s composition.
// Optionally drop in `voiceover.mp3` from /public for a single audio track.

import React from 'react';
import { Audio, Sequence, staticFile } from 'remotion';
import { Hook } from './Hook';
import { Prompt } from './Prompt';
import { Vision } from './Vision';
import { Dedup } from './Dedup';
import { Schedule } from './Schedule';
import { Action } from './Action';
import { Close } from './Close';
import { SCENE_FRAMES } from '../Root';

export const MainSequence: React.FC = () => {
  let from = 0;
  const scenes: Array<{ name: keyof typeof SCENE_FRAMES; component: React.FC }> = [
    { name: 'Hook', component: Hook },
    { name: 'Prompt', component: Prompt },
    { name: 'Vision', component: Vision },
    { name: 'Dedup', component: Dedup },
    { name: 'Schedule', component: Schedule },
    { name: 'Action', component: Action },
    { name: 'Close', component: Close },
  ];

  return (
    <>
      {/* Voiceover — drop a single 3-min mp3 at remotion/public/voiceover.mp3 */}
      {/* <Audio src={staticFile('voiceover.mp3')} /> */}
      {scenes.map(s => {
        const dur = SCENE_FRAMES[s.name];
        const start = from;
        from += dur;
        const Comp = s.component;
        return (
          <Sequence key={s.name} from={start} durationInFrames={dur} name={s.name}>
            <Comp />
          </Sequence>
        );
      })}
    </>
  );
};
