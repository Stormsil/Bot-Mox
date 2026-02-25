import { Input, type InputProps } from 'antd';
import type { FieldPath, FieldValues } from 'react-hook-form';
import { RHFFormItem, type RHFFormItemProps } from './RHFFormItem';

type BaseProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> = Omit<
  RHFFormItemProps<TFieldValues, TName>,
  'children'
>;

type RHFInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = BaseProps<TFieldValues, TName> &
  Omit<InputProps, 'value' | 'defaultValue' | 'onChange' | 'status'>;

export function RHFInput<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  rules,
  defaultValue,
  shouldUnregister,
  formItemProps,
  ...inputProps
}: RHFInputProps<TFieldValues, TName>) {
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
        <Input
          {...inputProps}
          value={typeof field.value === 'string' ? field.value : ((field.value ?? '') as string)}
          onChange={(event) => {
            field.onChange(event.target.value);
          }}
          onBlur={field.onBlur}
          name={field.name}
          ref={field.ref}
        />
      )}
    </RHFFormItem>
  );
}
