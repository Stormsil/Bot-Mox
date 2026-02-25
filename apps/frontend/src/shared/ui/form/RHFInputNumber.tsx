import { InputNumber, type InputNumberProps } from 'antd';
import type { FieldPath, FieldValues } from 'react-hook-form';
import { RHFFormItem, type RHFFormItemProps } from './RHFFormItem';

type BaseProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> = Omit<
  RHFFormItemProps<TFieldValues, TName>,
  'children'
>;

type RHFInputNumberProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = BaseProps<TFieldValues, TName> &
  Omit<InputNumberProps, 'value' | 'defaultValue' | 'onChange' | 'status'>;

export function RHFInputNumber<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(props: RHFInputNumberProps<TFieldValues, TName>) {
  const {
    control,
    name,
    label,
    rules,
    defaultValue,
    shouldUnregister,
    formItemProps,
    ...inputNumberProps
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
        <InputNumber
          {...inputNumberProps}
          value={field.value as InputNumberProps['value']}
          onChange={(value) => {
            field.onChange(value);
          }}
          onBlur={field.onBlur}
        />
      )}
    </RHFFormItem>
  );
}
