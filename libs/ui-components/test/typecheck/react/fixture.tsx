// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- consumers load generated ambient typings this way
/// <reference path="../../../types/react.d.ts" />
import type { ChipToggleDetail } from '../../../src/types';

export function Fixture() {
  const onToggle = (e: CustomEvent<ChipToggleDetail>) => e.detail.selected;
  return (
    <div>
      <bf-button variant="secondary" size="lg" onClick={() => undefined}>
        Save
      </bf-button>
      <bf-chip interactive selected value="aws" onbf-toggle={onToggle}>
        AWS
      </bf-chip>
      <bf-card variant="glow" highlighted>
        <span slot="heading">Card</span>
      </bf-card>
      <bf-theme-toggle theme="dark" onbf-theme-change={(e) => e.detail.theme satisfies 'light' | 'dark'} />
      <bf-dialog open close-label="Close">
        Body
      </bf-dialog>
      {/* @ts-expect-error invalid variant */}
      <bf-button variant="huge">Bad</bf-button>
      {/* @ts-expect-error event detail is typed */}
      <bf-chip onbf-toggle={(e: CustomEvent<{ nope: number }>) => e.detail.nope} />
    </div>
  );
}
