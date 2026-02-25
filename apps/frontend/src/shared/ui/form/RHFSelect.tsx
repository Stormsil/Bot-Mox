import { Select, type SelectProps } from 'antd';
import type { FieldPath, FieldValues } from 'react-hook-form';
import { RHFFormItem, type RHFFormItemProps } from './RHFFormItem';

type BaseProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> = Omit<
  RHFFormItemProps<TFieldValues, TName>,
  'children'
>;

type RHFSelectProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = BaseProps<TFieldValues, TName> &
  Omit<SelectProps, 'value' | 'defaultValue' | 'onChange' | 'status'>;

export function RHFSelect<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>(
  props: RHFSelectProps<TFieldValues, TName>,
) {
  const {
    control,
    name,
    label,
    rules,
    defaultValue,
    shouldUnregister,
    formItemProps,
    ...selectProps
  } = props;
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
      {({ field }) => (
        <Select
          {...selectProps}
          value={(field.value as SelectProps['value']) ?? undefined}
          onChange={(value) => {
            field.onChange(value);
          }}
          onBlur={field.onBlur}
        />
      )}
    </RHFFormItem>
  );
}
