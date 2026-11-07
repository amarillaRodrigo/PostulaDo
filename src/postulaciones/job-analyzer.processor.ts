import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { JobAnalyzerService } from './job-analyzer.service';
import { COLA_ANALISIS } from './cola-mantenimiento.service';

@Processor(COLA_ANALISIS)
export class JobAnalyzerProcessor extends WorkerHost {
  constructor(private readonly jobAnalyzer: JobAnalyzerService) {
    super();
  }

  async process(job: Job<{ url: string; profileText: string }>): Promise<any> {
    const { url, profileText } = job.data;
    const analysisResult = await this.jobAnalyzer.analyzeJob(url, profileText);
    return {
      url,
      ...analysisResult,
    };
  }
}
