import { type CvTemplate } from '../../../shared/constants';
import { type CvData } from '../../../shared/cv';
import { ScaledPage } from './parts';

export function PreviewPane({ data, template }: { data: CvData; template: CvTemplate }) {
  return (
    <div className="h-full overflow-y-auto px-10 py-8">
      <div className="mx-auto max-w-[640px]">
        <ScaledPage data={data} template={template} />
      </div>
    </div>
  );
}
