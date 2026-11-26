/// Author: Perijn Huijser
/// Summary: Convert temperatures between Celsius and Fahrenheit.
///
/// Description:
///     celsiusToFahrenheit converts a single reading; TemperatureConverter
///     also remembers the last reading for callers that poll a sensor.
///     Finite inputs convert exactly; NaN and infinity come back unchanged.
///
///     Quickstart — convert once at the display boundary:
///
///         print(celsiusToFahrenheit(100.0));  // 212.0
///
///     Readers that poll should call [TemperatureConverter.record] per
///     sample and read [TemperatureConverter.lastReading] when it is time
///     to show the value.
///
/// Changelog:
///     2026-08: Added TemperatureConverter for polling callers.

/// Temperature scale a reading is expressed in.
enum TemperatureScale { celsius, fahrenheit }

/// Clamp helpers shared by converter implementations.
mixin ClampsRange {
  /// Clamp a reading into the closed range low..high.
  double clampReading(double value, double low, double high) {
    return value < low ? low : (value > high ? high : value);
  }
}

/// Extension helpers for reading values carried as plain doubles.
extension ReadingTools on double {
  /// The reading rounded to three decimals for display.
  double get displayRounded => (this * 1000).roundToDouble() / 1000;
}

/// Convert Celsius to Fahrenheit; exact for finite inputs.
double celsiusToFahrenheit(double celsius) {
  return celsius * 9 / 5 + 32;
}

/// Convert a stream of readings and remember the last one.
class TemperatureConverter with ClampsRange {
  /// The most recent accepted reading, in Celsius.
  double lastReading = 0.0;

  /// Record a Celsius reading and return it in Fahrenheit.
  double record(double celsius) {
    lastReading = clampReading(celsius, -273.15, 1000.0);
    return celsiusToFahrenheit(lastReading);
  }
}
