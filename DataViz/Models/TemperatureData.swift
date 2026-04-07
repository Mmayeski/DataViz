import Foundation

enum Month: Int, CaseIterable, Identifiable {
    case january = 1, february, march, april, may, june
    case july, august, september, october, november, december

    var id: Int { rawValue }

    var shortName: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter.shortMonthSymbols[rawValue - 1]
    }

    var fullName: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter.monthSymbols[rawValue - 1]
    }
}

struct TemperatureRecord: Identifiable {
    let id = UUID()
    let month: Month
    let averageHigh: Double  // Fahrenheit
    let averageLow: Double   // Fahrenheit

    /// The midpoint between the average high and average low.
    var averageMid: Double {
        (averageHigh + averageLow) / 2.0
    }

    /// The spread between high and low temperatures.
    var range: Double {
        averageHigh - averageLow
    }
}

extension TemperatureRecord {
    /// Baltimore, MD average temperatures (Fahrenheit).
    static let baltimore: [TemperatureRecord] = [
        TemperatureRecord(month: .january,   averageHigh: 43, averageLow: 32),
        TemperatureRecord(month: .february,  averageHigh: 47, averageLow: 34),
        TemperatureRecord(month: .march,     averageHigh: 56, averageLow: 41),
        TemperatureRecord(month: .april,     averageHigh: 67, averageLow: 50),
        TemperatureRecord(month: .may,       averageHigh: 76, averageLow: 60),
        TemperatureRecord(month: .june,      averageHigh: 85, averageLow: 69),
        TemperatureRecord(month: .july,      averageHigh: 90, averageLow: 74),
        TemperatureRecord(month: .august,    averageHigh: 87, averageLow: 72),
        TemperatureRecord(month: .september, averageHigh: 80, averageLow: 65),
        TemperatureRecord(month: .october,   averageHigh: 69, averageLow: 53),
        TemperatureRecord(month: .november,  averageHigh: 57, averageLow: 43),
        TemperatureRecord(month: .december,  averageHigh: 46, averageLow: 34),
    ]
}
