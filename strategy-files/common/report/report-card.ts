import { AggType } from './types';

export class ReportCard {
  private value: number | string;
  private sum: number;
  private cnt: number;
  private aggType: AggType;

  constructor(private readonly name: string) {
    this.value = 0;
    this.sum = 0;
    this.cnt = 0;
    this.aggType = 'last';
  }

  setValue(value: number | string, aggType = 'last') {
    if (typeof value !== 'number') {
      this.value = value;
      this.aggType = 'last';
      return;
    }

    if (aggType === 'last') {
      this.value = value;
      return;
    }

    if (aggType === 'max') {
      this.value = Math.max(+this.value, value);
      return;
    }

    if (aggType === 'min') {
      if (this.value === 0) {
        this.value = value;
      }
      this.value = Math.min(+this.value, value);
      return;
    }

    if (aggType === 'avg' || aggType === 'sum') {
      this.sum += value;
      this.cnt++;
      return;
    }
  }

  getValue() {
    if (this.aggType === 'avg') {
      return Math.round((this.sum / this.cnt) * 100) / 100;
    }

    if (this.aggType === 'sum') {
      return Math.round(this.sum * 100) / 100;
    }

    if (typeof this.value === 'number') {
      return Math.round(this.value * 100) / 100;
    }
    return this.value;
  }

  prepareDataToReport(): CardDataReportBlock {
    return {
      type: 'card',
      data: {
        name: this.name,
        value: this.getValue(),
      },
    };
  }
}
