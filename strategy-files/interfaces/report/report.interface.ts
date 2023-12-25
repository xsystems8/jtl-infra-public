namespace ReportTypes {
  /// <reference path="report-tv.interface.ts" />

  interface GenericReportBlock<T extends ReportBlockType, D extends ReportBlockData> {
    type: T;
    name?: string;
    data: D;
  }

  interface ReportBlock {
    type: ReportBlockType;
    name?: string;
    data: ReportBlockData;
  }

  type TVChartData = ReportTradingView.TVChartData;

  type ReportBlockType = 'trading_view_chart' | 'table' | 'chart' | 'card' | 'optimizer_results';
  type ReportBlockData = TableRow[] | CardData | ChartData | TVChartData | Record<string, unknown>;

  type TableRow = Record<string, any>;

  interface CardData {
    name: string;
    value: string | number;
  }

  interface ChartData {
    series: Series[];
    time: string[];
  }

  interface Series {
    name: string;
    data: number[];
  }

  export type TableDataReportBlock = GenericReportBlock<'table', TableRow[]>;
  export type CardDataReportBlock = GenericReportBlock<'card', CardData>;
  export type ChartDataReportBlock = GenericReportBlock<'chart', ChartData>;
  export type TVChartDataReportBlock = GenericReportBlock<'trading_view_chart', TVChartData>;
  export type OptimizerResultsReportBlock = GenericReportBlock<'optimizer_results', Record<string, unknown>>;

  export interface ReportData {
    id: string;
    symbol: string;
    description?: string;
    blocks: ReportBlock[];
  }
}
