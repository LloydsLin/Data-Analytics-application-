import datetime
import numpy as np
import pandas as pd
from typing import Any, Dict, List, Optional
from scipy import stats

class ForecastEngine:
    """Statistical time-series forecasting engine with trendline and confidence intervals."""

    @staticmethod
    def forecast_metric(
        df: pd.DataFrame,
        date_column: str,
        value_column: str,
        periods: int = 3,
        frequency: str = "M"
    ) -> Dict[str, Any]:
        """Generate a monthly time-series forecast using trend regression and exponential smoothing."""
        if date_column not in df.columns or value_column not in df.columns:
            return {"error": f"Columns '{date_column}' or '{value_column}' not found in dataset."}

        # Clean and parse dates
        temp_df = df[[date_column, value_column]].copy()
        temp_df[date_column] = pd.to_datetime(temp_df[date_column], errors="coerce")
        temp_df[value_column] = pd.to_numeric(temp_df[value_column], errors="coerce")
        temp_df = temp_df.dropna().sort_values(date_column)

        if len(temp_df) < 4:
            return {"error": "Insufficient historical data points for forecasting."}

        # Monthly aggregation
        temp_df["Month"] = temp_df[date_column].dt.to_period("M")
        monthly_series = temp_df.groupby("Month")[value_column].sum()
        
        if len(monthly_series) < 3:
            return {"error": "Need at least 3 months of data to compute trend forecast."}

        historical_dates = [str(p) for p in monthly_series.index]
        historical_values = [round(float(v), 2) for v in monthly_series.values]

        # Fit linear regression trend
        x = np.arange(len(historical_values))
        y = np.array(historical_values)
        slope, intercept, r_val, p_val, std_err = stats.linregress(x, y)

        # Forecast future points
        last_period = monthly_series.index[-1]
        future_dates = []
        future_values = []
        lower_bounds = []
        upper_bounds = []

        # Residual standard error for confidence band
        fitted = intercept + slope * x
        residuals = y - fitted
        residual_std = np.std(residuals) if len(residuals) > 1 else (y.mean() * 0.1)

        for i in range(1, periods + 1):
            next_period = last_period + i
            future_dates.append(str(next_period))
            pred_val = max(0.0, float(intercept + slope * (len(x) + i - 1)))
            
            # Dampen or blend with moving average of last 3 months
            recent_avg = float(np.mean(historical_values[-3:]))
            blended_val = round(0.7 * pred_val + 0.3 * recent_avg, 2)
            future_values.append(blended_val)

            # 90% confidence interval band
            margin = round(1.645 * residual_std * np.sqrt(1 + (1 / len(x)) + (i * 0.1)), 2)
            lower_bounds.append(max(0.0, round(blended_val - margin, 2)))
            upper_bounds.append(round(blended_val + margin, 2))

        growth_rate = round(((future_values[-1] - historical_values[-1]) / max(historical_values[-1], 1)) * 100, 1)

        # Plotly traces
        traces = [
            {
                "name": "Historical " + value_column,
                "x": historical_dates,
                "y": historical_values,
                "type": "scatter",
                "mode": "lines+markers",
                "line": {"color": "#6366f1", "width": 3},
                "marker": {"size": 6}
            },
            {
                "name": f"Forecasted {value_column} (+{periods} Mo)",
                "x": [historical_dates[-1]] + future_dates,
                "y": [historical_values[-1]] + future_values,
                "type": "scatter",
                "mode": "lines+markers",
                "line": {"color": "#10b981", "width": 3, "dash": "dash"},
                "marker": {"size": 7, "color": "#10b981"}
            },
            {
                "name": "Upper Confidence Bound (90%)",
                "x": future_dates,
                "y": upper_bounds,
                "type": "scatter",
                "mode": "lines",
                "line": {"width": 0},
                "showlegend": False
            },
            {
                "name": "Lower Confidence Bound (90%)",
                "x": future_dates,
                "y": lower_bounds,
                "type": "scatter",
                "mode": "lines",
                "line": {"width": 0},
                "fill": "tonexty",
                "fillcolor": "rgba(16, 185, 129, 0.15)",
                "showlegend": False
            }
        ]

        chart_spec = {
            "type": "line",
            "title": f"Monthly {value_column} Forecast (Next {periods} Months)",
            "traces": traces
        }

        return {
            "metric": value_column,
            "periods": periods,
            "historical_periods": len(historical_dates),
            "historical_dates": historical_dates,
            "historical_values": historical_values,
            "future_dates": future_dates,
            "future_values": future_values,
            "projected_growth_rate_pct": growth_rate,
            "r_squared": round(float(r_val ** 2), 3),
            "chart": chart_spec,
            "summary": f"Projected {growth_rate:+}% growth over next {periods} months based on historical trendline (R² = {round(r_val**2, 2)})."
        }

forecast_engine = ForecastEngine()
