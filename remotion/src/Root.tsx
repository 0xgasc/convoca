// remotion/src/Root.tsx
// Composition registry. Each scene maps to a section in DEMO_SCRIPT.md.
// Frame counts at 30fps.

import { Composition } from 'remotion';
import { Hook } from './compositions/Hook';
import { Prompt } from './compositions/Prompt';
import { Vision } from './compositions/Vision';
import { Dedup } from './compositions/Dedup';
import { Schedule } from './compositions/Schedule';
import { Action } from './compositions/Action';
import { Close } from './compositions/Close';
import { MainSequence } from './compositions/MainSequence';

const FPS = 30;
const W = 1920;
const H = 1080;

const sec = (s: number) => s * FPS;

export const SCENE_FRAMES = {
  Hook: sec(22),
  Prompt: sec(33),
  Vision: sec(35),
  Dedup: sec(35),
  Schedule: sec(25),
  Action: sec(25),
  Close: sec(5),
};

export const TOTAL_FRAMES = Object.values(SCENE_FRAMES).reduce((a, b) => a + b, 0);

export const Root: React.FC = () => (
  <>
    <Composition id="MainSequence" component={MainSequence} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="Hook"     component={Hook}     durationInFrames={SCENE_FRAMES.Hook}     fps={FPS} width={W} height={H} />
    <Composition id="Prompt"   component={Prompt}   durationInFrames={SCENE_FRAMES.Prompt}   fps={FPS} width={W} height={H} />
    <Composition id="Vision"   component={Vision}   durationInFrames={SCENE_FRAMES.Vision}   fps={FPS} width={W} height={H} />
    <Composition id="Dedup"    component={Dedup}    durationInFrames={SCENE_FRAMES.Dedup}    fps={FPS} width={W} height={H} />
    <Composition id="Schedule" component={Schedule} durationInFrames={SCENE_FRAMES.Schedule} fps={FPS} width={W} height={H} />
    <Composition id="Action"   component={Action}   durationInFrames={SCENE_FRAMES.Action}   fps={FPS} width={W} height={H} />
    <Composition id="Close"    component={Close}    durationInFrames={SCENE_FRAMES.Close}    fps={FPS} width={W} height={H} />
  </>
);
