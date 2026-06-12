using LogiTrack.Api.Core;
using static LogiTrack.Api.Core.NumberUtil;
using static LogiTrack.Api.Engines.Metrics;

namespace LogiTrack.Api.Engines;

/// <summary>
/// Dual Landed Cost (FDD): per finished-goods unit.
///   Manufacturing Landed Cost = Product Cost + Freight + Insurance + Packaging + Duties + Warehousing
///   Customer Landed Cost      = Manufacturing Landed Cost + Domestic Freight + Last Mile
///                               + Returns + Warranty Allocation + Fulfillment
/// Manufacturing landed cost supports supplier/manufacturing comparison; customer landed
/// cost supports profitability and the recommendation engine.
/// </summary>
public static class DualCostEngine
{
    // Representative finished-goods economics per appliance family (ASP, gross margin %, annual units).
    private static readonly Dictionary<string, (double Asp, double Margin, double Units)> Specs = new()
    {
        ["Refrigerator"] = (1100, 32, 800_000),
        ["Washing Machine"] = (750, 30, 1_200_000),
        ["Air Conditioner"] = (600, 28, 1_500_000),
        ["Microwave Oven"] = (130, 35, 2_000_000),
        ["Dishwasher"] = (650, 30, 600_000),
    };

    public static object Build(List<Row> lanes, List<Row> trade, List<Row> categories, string product)
    {
        var products = Specs.Keys.ToList();
        var all = products.Select(p => Compute(lanes, p)).ToList();
        var selected = all.FirstOrDefault(r => (string)r["product"]! == product) ?? all.FirstOrDefault();

        return new Dictionary<string, object?>
        {
            ["product"] = selected is null ? product : selected["product"],
            ["selected"] = selected,
            ["by_product"] = all.Cast<object>().ToList(),
        };
    }

    private static Dictionary<string, object?> Compute(List<Row> lanes, string product)
    {
        var spec = Specs.TryGetValue(product, out var s) ? s : (600.0, 30.0, 500_000.0);
        double asp = spec.Item1, marginPct = spec.Item2, annualUnits = spec.Item3;
        double productCost = asp * (1 - marginPct / 100.0);   // unit COGS proxy

        // international freight per unit = product's annual freight / annual units
        var pLanes = lanes.Where(l => l.GetString("Product_Category") == product).ToList();
        double annualFreight = pLanes.Sum(LaneAnnualFreight);
        double intlFreight = SafeDiv(annualFreight, annualUnits);
        // keep it sane relative to product value
        intlFreight = Math.Min(intlFreight, productCost * 0.25);

        // ── Manufacturing Landed Cost components (per unit) ──
        double insurance = productCost * 0.004;
        double packaging = asp >= 800 ? 9.5 : asp >= 400 ? 6.0 : 2.5;
        double duties = productCost * 0.035;
        double warehousing = asp >= 800 ? 7.0 : asp >= 400 ? 4.5 : 1.8;
        double mfgLanded = productCost + intlFreight + insurance + packaging + duties + warehousing;

        // ── Customer Landed Cost additional components (per unit) ──
        double domesticFreight = intlFreight * 0.35 + (asp >= 800 ? 12 : 5);
        double lastMile = asp >= 800 ? 45 : asp >= 400 ? 28 : 6;
        double returns = asp * 0.02;
        double warranty = asp * 0.03;
        double fulfillment = asp >= 800 ? 14 : 8;
        double custLanded = mfgLanded + domesticFreight + lastMile + returns + warranty + fulfillment;

        return new Dictionary<string, object?>
        {
            ["product"] = product,
            ["asp_usd"] = R2(asp),
            ["annual_units"] = annualUnits,
            ["manufacturing_landed_cost_usd"] = R2(mfgLanded),
            ["customer_landed_cost_usd"] = R2(custLanded),
            ["margin_per_unit_usd"] = R2(asp - custLanded),
            ["manufacturing_components"] = new List<object>
            {
                Comp("Product cost", productCost), Comp("International freight", intlFreight),
                Comp("Insurance", insurance), Comp("Packaging", packaging),
                Comp("Duties", duties), Comp("Warehousing", warehousing),
            },
            ["customer_components"] = new List<object>
            {
                Comp("Manufacturing landed", mfgLanded), Comp("Domestic freight", domesticFreight),
                Comp("Last mile", lastMile), Comp("Returns", returns),
                Comp("Warranty allocation", warranty), Comp("Fulfillment", fulfillment),
            },
        };
    }

    private static Dictionary<string, object?> Comp(string label, double v) => new()
    {
        ["label"] = label, ["value_usd"] = R2(v),
    };
}
