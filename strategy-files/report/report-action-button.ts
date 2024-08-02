export class ReportActionButton {
  constructor(private readonly title: string, private readonly paramName: string, private value: string | number) {}

  updateValue(value: string | number) {
    this.value = value;
  }

  prepareDataToReport() {
    return {
      type: 'action_button' as 'action_button',
      data: {
        title: this.title,
        paramName: this.paramName,
        value: this.value,
      },
    };
  }
}
