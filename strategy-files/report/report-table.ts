// export type TableRow = Record<string, string | number>;
export type TableRow = object;

export class ReportTable {
  rows: Record<string, TableRow> = {};
  iterator = 0;
  MAX_ROWS = 300;

  constructor(private readonly name: string) {}

  getIdFromRow(row: TableRow, idField = 'id') {
    row[idField] = row[idField] !== undefined ? row[idField] : this.iterator;
    return row[idField];
  }

  insert(row: TableRow, idField = 'id') {
    let id = this.getIdFromRow(row, idField);

    if (!this.rows[idField] === undefined && this.rows[id] === undefined) {
      return false;
    }

    this.rows[id] = row;
    this.iterator++;
    return true;
  }

  update(row: TableRow, idField = 'id') {
    let id = this.getIdFromRow(row, idField);

    if (this.rows[idField] === undefined) {
      return false;
    }

    this.rows[id] = { ...this.rows[id], ...row };
    //this.rows[id] = row;
    return true;
  }
  insertUpdate(row: TableRow, idField = 'id') {
    if (!row[idField] || !this.rows[idField]) {
      return this.insert(row, idField);
    } else {
      return this.update(row, idField);
    }
  }
  insertRecords(rows: TableRow[], idField = 'id') {
    for (let i = 0; i < rows.length; i++) {
      this.insert(rows[i], idField);
    }
  }

  updateRecords(rows: TableRow[], idField = 'id') {
    for (let i = 0; i < rows.length; i++) {
      this.update(rows[i], idField);
    }
  }
  insertUpdateRecords(rows: TableRow[], idField = 'id') {
    for (let i = 0; i < rows.length; i++) {
      this.insertUpdate(rows[i], idField);
    }
  }

  prepareDataToReport = (): TableDataReportBlock => {
    return {
      type: 'table',
      name: this.name,
      data: Object.values(this.rows).slice(-this.MAX_ROWS),
    };
  };
}
