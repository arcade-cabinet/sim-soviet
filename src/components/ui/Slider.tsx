import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

/**
 * Render a multi-thumb slider built on Radix UI primitives with configurable values, bounds, and styling.
 *
 * @param className - Additional CSS classes applied to the root slider element
 * @param defaultValue - Initial slider value(s) when uncontrolled; can be a single number or an array for multiple thumbs
 * @param value - Controlled slider value(s); can be a single number or an array for multiple thumbs
 * @param min - Minimum slider value (default: 0)
 * @param max - Maximum slider value (default: 100)
 * @param props - Additional props forwarded to the underlying Radix Slider Root
 * @returns A slider element containing a track, a filled range, and one thumb per provided value
 */
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
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max],
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
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="bg-[#444] relative grow overflow-hidden rounded-full h-1.5 w-full"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="bg-[#8b0000] absolute h-full"
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="border-[#8b0000] bg-[#d3c4a9] block size-5 shrink-0 rounded-full border-2 shadow-sm transition-[color,box-shadow] hover:ring-4 hover:ring-[#8b0000]/30 focus-visible:ring-4 focus-visible:ring-[#8b0000]/30 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };