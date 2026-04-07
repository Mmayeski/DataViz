import Foundation

enum ChartType: String, CaseIterable {
    case bar, line, area

    /// Cycles to the next chart type, wrapping around to the first.
    func next() -> ChartType {
        let all = ChartType.allCases
        let index = (all.firstIndex(of: self)! + 1) % all.count
        return all[index]
    }

    /// The corresponding SF Symbol name for this chart type.
    var iconName: String {
        switch self {
        case .bar:  return "chart.bar"
        case .line: return "chart.line.uptrend.xyaxis"
        case .area: return "chart.area"
        }
    }
}

enum SortOrder: String, CaseIterable {
    case chronological, hottestFirst, coldestFirst

    var label: String {
        switch self {
        case .chronological: return "Chronological"
        case .hottestFirst:  return "Hottest First"
        case .coldestFirst:  return "Coldest First"
        }
    }
}

enum MonthFilter: String, CaseIterable {
    case all, firstHalf, secondHalf, summer, winter

    /// Returns `true` if the given month passes this filter.
    func applies(to month: Month) -> Bool {
        switch self {
        case .all:
            return true
        case .firstHalf:
            return month.rawValue >= 1 && month.rawValue <= 6
        case .secondHalf:
            return month.rawValue >= 7 && month.rawValue <= 12
        case .summer:
            return month.rawValue >= 6 && month.rawValue <= 8
        case .winter:
            return month.rawValue == 12 || month.rawValue <= 2
        }
    }

    var label: String {
        switch self {
        case .all:        return "All Months"
        case .firstHalf:  return "Jan \u{2013} Jun"
        case .secondHalf: return "Jul \u{2013} Dec"
        case .summer:     return "Summer"
        case .winter:     return "Winter"
        }
    }
}

enum ChartColorScheme: String, CaseIterable {
    case temperature, monochrome, seasonal

    /// Cycles to the next color scheme, wrapping around to the first.
    func next() -> ChartColorScheme {
        let all = ChartColorScheme.allCases
        let index = (all.firstIndex(of: self)! + 1) % all.count
        return all[index]
    }

    var label: String {
        switch self {
        case .temperature: return "Temperature"
        case .monochrome:  return "Monochrome"
        case .seasonal:    return "Seasonal"
        }
    }
}
