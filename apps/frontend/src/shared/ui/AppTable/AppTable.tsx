import type { TablePaginationConfig, TableProps } from 'antd';
import { Table } from 'antd';

const DEFAULT_PAGE_SIZE = 10;

const defaultShowTotal: NonNullable<TablePaginationConfig['showTotal']> = (total) =>
  `Total ${total} items`;

function mergePagination<T extends object>(
  pagination: TableProps<T>['pagination'],
): TableProps<T>['pagination'] {
  if (pagination === false) {
    return false;
  }

  const defaultPagination: TablePaginationConfig = {
    pageSize: DEFAULT_PAGE_SIZE,
    showSizeChanger: true,
    showTotal: defaultShowTotal,
  };

  if (!pagination || typeof pagination !== 'object') {
    return defaultPagination;
  }

  return {
    ...defaultPagination,
    ...pagination,
  };
}

export function AppTable<T extends object>(props: TableProps<T>) {
  const { size = 'small', style, pagination, ...restProps } = props;

  return (
    <Table<T>
      {...restProps}
      size={size}
      pagination={mergePagination(pagination)}
      style={{ width: '100%', ...style }}
    />
  );
}
