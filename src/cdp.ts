import type { CdpSession, PageDriver } from './driver.js';

/** A CDP session for one page, with the throttling calls the runner needs. */
export class PageCdp {
  private constructor(private readonly session: CdpSession) {}

  static async open(page: PageDriver): Promise<PageCdp> {
    return new PageCdp(await page.cdp());
  }

  /**
   * Slows the page's CPU. Re-applied before every run, because a reload can move the page to
   * a new renderer process. https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setCPUThrottlingRate
   */
  async throttle(rate: number): Promise<void> {
    await this.session.send('Emulation.setCPUThrottlingRate', { rate });
  }

  async close(): Promise<void> {
    await this.session.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => undefined);
    await this.session.detach().catch(() => undefined);
  }
}
