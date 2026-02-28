import * as SliderPrimitive from '@radix-ui/react-slider';
import * as React from 'react';
import { cn } from '@/lib/utils';

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : value != null
          ? [value]
          : Array.isArray(defaultValue)
            ? defaultValue
            : defaultValue != null
              ? [defaultValue]
              : [min],
    [value, defaultValue, min]
  );

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        'relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="bg-[#444] relative grow overflow-hidden rounded-full h-1.5 w-full"
      >
        <SliderPrimitive.Range data-slot="slider-range" className="bg-[#8b0000] absolute h-full" />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          // biome-ignore lint/suspicious/noArrayIndexKey: slider thumbs are positional, not reorderable
          key={index}
          className="border-[#8b0000] bg-[#d3c4a9] block size-5 shrink-0 rounded-full border-2 shadow-sm transition-[color,box-shadow] hover:ring-4 hover:ring-[#8b0000]/30 focus-visible:ring-4 focus-visible:ring-[#8b0000]/30 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
