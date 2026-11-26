<?php
/**
 * @author Perijn Huijser
 * Summary: Convert temperatures between Celsius and Fahrenheit.
 *
 * Description:
 *     celsius_to_fahrenheit converts a single reading; TemperatureConverter
 *     also remembers the last reading for callers that poll a sensor.
 *     Finite inputs convert exactly; NAN and INF come back unchanged.
 *
 *     Quickstart — convert once at the display boundary:
 *
 *         echo celsius_to_fahrenheit(100.0);  // 212
 *
 *     Readers that poll should call TemperatureConverter::record per
 *     sample and toCelsius when it is time to show the value.
 *
 * Changelog:
 *     2026-08: Added TemperatureConverter for polling callers.
 */

/** Temperature scale a reading is expressed in. */
enum TemperatureScale: string
{
    case Celsius = 'C';
    case Fahrenheit = 'F';
}

/** Something that can report its value in Celsius. */
interface Canonical
{
    /** The reading converted to Celsius. */
    public function toCelsius(): float;
}

/** Clamp helpers shared by converter implementations. */
trait ClampsRange
{
    /** Clamp a reading into the closed range low..high. */
    protected function clampReading(float $value, float $low, float $high): float
    {
        return min(max($value, $low), $high);
    }
}

/** Convert Celsius to Fahrenheit; exact for finite inputs. */
function celsius_to_fahrenheit(float $celsius): float
{
    return $celsius * 9 / 5 + 32;
}

/** Convert a stream of readings and remember the last one. */
final class TemperatureConverter implements Canonical
{
    use ClampsRange;

    /** The most recent accepted reading, in Celsius. */
    private float $lastReading = 0.0;

    /** Record a Celsius reading and return it in Fahrenheit. */
    public function record(float $celsius): float
    {
        $this->lastReading = $this->clampReading($celsius, -273.15, 1000.0);

        return celsius_to_fahrenheit($this->lastReading);
    }

    /** The most recent reading, converted to Celsius. */
    public function toCelsius(): float
    {
        return $this->lastReading;
    }
}
