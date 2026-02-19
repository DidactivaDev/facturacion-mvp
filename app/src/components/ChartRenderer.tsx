"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

interface ChartData {
  type: "bar" | "pie" | "line";
  title?: string;
  data: Record<string, string | number>[];
  keys?: string[];
}

const COLORS = [
  "oklch(0.55 0.18 265)",
  "oklch(0.60 0.17 160)",
  "oklch(0.65 0.20 45)",
  "oklch(0.55 0.22 310)",
  "oklch(0.60 0.18 80)",
  "oklch(0.50 0.15 200)",
  "oklch(0.65 0.15 130)",
  "oklch(0.55 0.20 350)",
];

function formatValue(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString("es-MX")}`;
}

interface ChartRendererProps {
  json: string;
}

export default function ChartRenderer({ json }: ChartRendererProps) {
  let chartData: ChartData;
  try {
    chartData = JSON.parse(json);
  } catch {
    return null;
  }

  if (!chartData.data || !Array.isArray(chartData.data) || chartData.data.length === 0) {
    return null;
  }

  const { type, title, data, keys } = chartData;

  // Determine value keys
  const valueKeys =
    keys ||
    Object.keys(data[0]).filter((k) => k !== "name" && typeof data[0][k] === "number");

  if (valueKeys.length === 0) return null;

  const isMultiSeries = valueKeys.length > 1;

  return (
    <div className="my-3 rounded-xl border bg-background p-4">
      {title && (
        <h4 className="text-xs font-semibold text-foreground mb-3">{title}</h4>
      )}

      <div className="w-full" style={{ height: type === "pie" ? 280 : 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          {type === "pie" ? (
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                dataKey={valueKeys[0]}
                nameKey="name"
                label={(props) => {
                  const name = String(props.name ?? "");
                  const pct = typeof props.percent === "number" ? props.percent : 0;
                  return `${name} (${(pct * 100).toFixed(0)}%)`;
                }}
                labelLine={{ strokeWidth: 1 }}
              >
                {data.map((_entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => formatValue(Number(value))}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid oklch(0.91 0.02 265)",
                  fontSize: "12px",
                }}
              />
            </PieChart>
          ) : type === "line" ? (
            <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.02 265)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "oklch(0.91 0.02 265)" }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatValue(v)}
              />
              <Tooltip
                formatter={(value) => formatValue(Number(value))}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid oklch(0.91 0.02 265)",
                  fontSize: "12px",
                }}
              />
              {isMultiSeries && <Legend wrapperStyle={{ fontSize: "11px" }} />}
              {valueKeys.map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          ) : (
            /* Bar chart (default) */
            <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.02 265)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "oklch(0.91 0.02 265)" }}
                interval={0}
                angle={data.length > 8 ? -35 : 0}
                textAnchor={data.length > 8 ? "end" : "middle"}
                height={data.length > 8 ? 70 : 30}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatValue(v)}
              />
              <Tooltip
                formatter={(value) => formatValue(Number(value))}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid oklch(0.91 0.02 265)",
                  fontSize: "12px",
                }}
              />
              {isMultiSeries && <Legend wrapperStyle={{ fontSize: "11px" }} />}
              {valueKeys.map((key, i) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={COLORS[i % COLORS.length]}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={50}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
