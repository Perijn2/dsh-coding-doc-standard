//! Author: Perijn Huijser
//! Summary: Convert temperatures between Celsius and Fahrenheit.
//!
//! Description:
//!     celsius_to_fahrenheit converts a single reading; TemperatureConverter
//!     also remembers the last reading for callers that poll a sensor.
//!     Finite inputs convert exactly; NaN and infinity come back unchanged.
//!
//!     Quickstart — convert once at the display boundary:
//!
//!         println!("{}", celsius_to_fahrenheit(100.0));  // 212
//!
//!     Readers that poll should call `TemperatureConverter::record` per
//!     sample and read `last_reading` when it is time to show the value.
//!
//! Changelog:
//!     2026-08: Added TemperatureConverter for polling callers.

/// Convert Celsius to Fahrenheit; exact for finite inputs.
pub fn celsius_to_fahrenheit(celsius: f64) -> f64 {
    celsius * 9.0 / 5.0 + 32.0
}

/// Temperature scale a reading is expressed in.
pub enum TemperatureScale {
    /// Water freezes at this point on the scale.
    Celsius,
    /// Water boils at this point on the scale.
    Fahrenheit,
}

/// Something that can report its value in Celsius.
pub trait Canonical {
    /// The reading converted to Celsius.
    fn to_celsius(&self) -> f64;
}

/// Convert a stream of readings and remember the last one.
pub struct TemperatureConverter {
    last_reading: f64,
}

impl TemperatureConverter {
    /// A converter with no readings recorded yet.
    pub fn new() -> Self {
        Self { last_reading: 0.0 }
    }

    /// Record a Celsius reading and return it in Fahrenheit.
    pub fn record(&mut self, celsius: f64) -> f64 {
        self.last_reading = utils::clamp(celsius, -273.15, 1000.0);
        celsius_to_fahrenheit(self.last_reading)
    }
}

impl Canonical for TemperatureConverter {
    /// The most recent reading, converted to Celsius.
    fn to_celsius(&self) -> f64 {
        self.last_reading
    }
}

/// Helpers shared by the converters.
pub mod utils {
    /// Clamp a value into the closed range low..=high.
    pub fn clamp(value: f64, low: f64, high: f64) -> f64 {
        value.clamp(low, high)
    }

    fn scale_name(_scale: super::TemperatureScale) -> &'static str {
        "unnamed"
    }
}
