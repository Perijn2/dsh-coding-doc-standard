/// Author: Perijn Huijser
/// Summary: Convert temperatures between Celsius and Fahrenheit.
///
/// Description:
///     celsiusToFahrenheit converts a single reading; TemperatureConverter
///     also remembers the last reading for callers that poll a sensor.
///     Finite inputs convert exactly; NAN and INF come back unchanged.
///
///     Quickstart — convert once at the display boundary:
///
///         print(celsiusToFahrenheit(100.0))  // 212.0
///
///     Readers that poll should call `record` per sample and read
///     `lastReading` when it is time to show the value.
///
/// Changelog:
///     2026-08: Added TemperatureConverter for polling callers.

/// Temperature scale a reading is expressed in.
enum TemperatureScale {
	case celsius
	case fahrenheit
}

/// Something that can report its value in Celsius.
protocol Canonical {
	/// The reading converted to Celsius.
	var celsiusValue: Double { get }
}

/// Convert Celsius to Fahrenheit; exact for finite inputs.
func celsiusToFahrenheit(_ celsius: Double) -> Double {
	celsius * 9 / 5 + 32
}

/// Convert a stream of readings and remember the last one.
final class TemperatureConverter: Canonical {
	/// The most recent accepted reading, in Celsius.
	private(set) var lastReading = 0.0

	/// Record a Celsius reading and return it in Fahrenheit.
	func record(_ celsius: Double) -> Double {
		lastReading = min(max(celsius, -273.15), 1000.0)
		return celsiusToFahrenheit(lastReading)
	}

	/// The most recent reading, converted to Celsius.
	var celsiusValue: Double {
		lastReading
	}
}
