import type { Program } from "./core";

export class ProgramTester {
  constructor(readonly program: Program) {}

  async run(args: string[]): Promise<ResultTester> {
    const result = await this.program.run(args);

    return new ResultTester(result);
  }
}

export class ResultTester {
  constructor(readonly result: number) {}

  isSuccess(): boolean {
    return this.result === 0;
  }

  isFailure(): boolean {
    return this.result === 1;
  }

  isInvalid(): boolean {
    return this.result === 2;
  }

  isUnknown(): boolean {
    return ![0, 1, 2].includes(this.result);
  }
}
