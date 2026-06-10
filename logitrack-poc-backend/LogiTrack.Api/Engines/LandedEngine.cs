using LogiTrack.Api.Core;
using static LogiTrack.Api.Core.NumberUtil;
using static LogiTrack.Api.Engines.Metrics;

namespace LogiTrack.Api.Engines;

/// <summary>
/// Landed Cost vs Emissions — product-family and SKU-level decomposition.
/// Families = product categories from lanes. SKUs are derived per family.
/// </summary>
public static class LandedEngine
{
    public static object Build(List<Row> lanes, List<Row> trade, List<Row> categories,
        List<Row> skus, double carbonPrice, Row fin)
    {
        double grossMarginPct = fin.GetDouble("Gross_Margin_Pct", 38.0);

        // Group lanes by product category (= family)
        var lanesByFamily = lanes
            .GroupBy(l => l.GetString("Product_Category"))
            .Where(g => !string.IsNullOrEmpty(g.Key))
            .ToDictionary(g => g.Key, g => g.ToList());

        // Revenue assumption: freight is ~28% of landed cost; margin applied to landed
        var byFamily = new List<object>();
        var bySku = new List<object>();

        var rng = new PyRandom(42);

        foreach (var cat in categories)
        {
            string family = cat.GetString("Product_Category");
            if (!lanesByFamily.TryGetValue(family, out var famLanes) || famLanes.Count == 0) continue;

            int totalShip = famLanes.Sum(LaneShipments);
            if (totalShip == 0) continue;

            double totalLandedCost = famLanes.Sum(l =>
                (double)SustainabilityEngine.LaneLanded(l, trade, carbonPrice)["landed_cost_per_shipment"]! * LaneShipments(l));
            double totalLandedEm = famLanes.Sum(l =>
                (double)SustainabilityEngine.LaneLanded(l, trade, carbonPrice)["landed_emissions_per_shipment"]! * LaneShipments(l));
            double avgLandedCost = SafeDiv(totalLandedCost, totalShip);
            double avgLandedEm = SafeDiv(totalLandedEm, totalShip);

            double annualVolume = cat.GetDouble("Annual_Volume_Units", totalShip * 5.0);
            // Estimate revenue & margin from cost
            double revenuePerUnit = avgLandedCost * (100.0 / (100.0 - grossMarginPct));
            double marginPerUnit = revenuePerUnit * grossMarginPct / 100.0;
            // Carbon efficiency margin = gross margin generated per tonne CO₂e
            double cemFam = avgLandedEm > 0.0001 ? R2(marginPerUnit / avgLandedEm) : 0.0;

            // Determine how many SKUs this family has (from skus table or derive)
            var famSkus = skus.Where(sk => sk.GetString("Family") == family).ToList();
            int skuCount = famSkus.Count > 0 ? famSkus.Count : (int)cat.GetDouble("SKU_Count", rng.RandInt(2, 6));

            byFamily.Add(new Dictionary<string, object?>
            {
                ["family"] = family,
                ["skus"] = skuCount,
                ["annual_volume"] = (int)annualVolume,
                ["avg_landed_cost"] = R2(avgLandedCost),
                ["avg_landed_emissions"] = R3(avgLandedEm),
                ["avg_margin"] = R2(marginPerUnit),
                ["carbon_efficiency_margin"] = cemFam,
            });

            // Build per-SKU rows
            if (famSkus.Count > 0)
            {
                foreach (var sk in famSkus)
                {
                    double skuVol = sk.GetDouble("Annual_Volume_Units", annualVolume / skuCount);
                    double factor = rng.Uniform(0.75, 1.35);
                    double lc = R2(avgLandedCost * factor);
                    double le = R3(avgLandedEm * factor);
                    double mp = R2(marginPerUnit * factor);
                    double cem = le > 0.0001 ? R2(mp / le) : 0.0;
                    bySku.Add(new Dictionary<string, object?>
                    {
                        ["sku"] = sk.GetString("SKU_ID"),
                        ["family"] = family,
                        ["annual_volume"] = (int)skuVol,
                        ["landed_cost_per_unit"] = lc,
                        ["landed_emissions_per_unit"] = le,
                        ["margin_per_unit"] = mp,
                        ["carbon_efficiency_margin"] = cem,
                    });
                }
            }
            else
            {
                // Derive synthetic SKUs from lane spread
                for (int i = 1; i <= skuCount; i++)
                {
                    double factor = rng.Uniform(0.70, 1.40);
                    double lc = R2(avgLandedCost * factor);
                    double le = R3(avgLandedEm * factor);
                    double mp = R2(marginPerUnit * factor);
                    double cem = le > 0.0001 ? R2(mp / le) : 0.0;
                    string skuCode = family.Length >= 3
                        ? $"{family[..3].ToUpper()}-{i:D3}"
                        : $"SKU-{i:D3}";
                    bySku.Add(new Dictionary<string, object?>
                    {
                        ["sku"] = skuCode,
                        ["family"] = family,
                        ["annual_volume"] = (int)(annualVolume / skuCount),
                        ["landed_cost_per_unit"] = lc,
                        ["landed_emissions_per_unit"] = le,
                        ["margin_per_unit"] = mp,
                        ["carbon_efficiency_margin"] = cem,
                    });
                }
            }
        }

        return new Dictionary<string, object?>
        {
            ["by_family"] = byFamily,
            ["by_sku"] = bySku,
        };
    }
}
