import { DatePicker, type DatePickerProps } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type { FieldPath, FieldValues } from 'react-hook-form';
import { RHFFormItem, type RHFFormItemProps } from './RHFFormItem';

type BaseProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> = Omit<
  RHFFormItemProps<TFieldValues, TName>,
  'children'
>;

type RHFDatePickerProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
  TValue = unknown,
> = BaseProps<TFieldValues, TName> &
  Omit<DatePickerProps, 'value' | 'defaultValue' | 'onChange' | 'status'> & {
    toFormValue?: (date: Dayjs | null) => TValue;
    fromFormValue?: (value: TValue) => Dayjs | null;
  };

function defaultToFormValue(date: Dayjs | null): number | null {
  return date ? date.valueOf() : null;
}

export function RHFDatePicker<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
  TValue = unknown,
>({
  toFormValue,
  fromFormValue,
  control,
  name,
  label,
  rules,
  defaultValue,
  shouldUnregister,
  formItemProps,
  ...datePickerProps
}: RHFDatePickerProps<TFieldValues, TName, TValue>) {
  return (
    <RHFFormItem
      control={control}
      name={name}
      label={label}
      rules={rules}
      defaultValue={defaultValue}
      shouldUnregister={shouldUnregister}
      formItemProps={formItemProps}
    >
      {({ field }) => {
        const resolveFromFormValue =
          fromFormValue ??
          ((value: TValue) => {
            if (value == null || value === '') return null;
            if (typeof value === 'number' && Number.isFinite(value)) {
              const parsed = dayjs(value);
              return parsed.isValid() ? parsed : null;
            }
            if (typeof value === 'string' && value.trim() !== '') {
              const parsed = dayjs(value);
              return parsed.isValid() ? parsed : null;
            }
            return null;
          });

        const resolveToFormValue =
          toFormValue ?? ((date: Dayjs | null) => defaultToFormValue(date) as TValue);

        return (
          <DatePicker
            {...datePickerProps}
            value={resolveFromFormValue(field.value as TValue)}
            onChange={(date) => {
              field.onChange(resolveToFormValue(date));
            }}
            onBlur={field.onBlur}
          />
        );
      }}
    </RHFFormItem>
  );
}
