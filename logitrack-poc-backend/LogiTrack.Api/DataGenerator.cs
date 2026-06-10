using LogiTrack.Api.Core;

namespace LogiTrack.Api;

/// <summary>
/// Generates a large deterministic synthetic dataset.
/// 210 suppliers · 26 plants · 80 DCs · 25 ports · 5 000+ lanes.
/// </summary>
public static class DataGenerator
{
    // ── geographic definitions ──────────────────────────────────────────────

    private record Loc(string Name, string Country, double Lat, double Lng, string? Category = null);

    private static readonly Loc[] Suppliers = new[]
    {
        // China (CN) -55 suppliers
        new Loc("Shenzhen Electronics Co", "CN", 22.54, 114.06, "Electronics Modules"),
        new Loc("Foxconn Shenzhen", "CN", 22.58, 113.92, "Semiconductor Assemblies"),
        new Loc("BYD Auto Parts", "CN", 22.65, 114.10, "Battery Cells"),
        new Loc("Huawei Parts Shenzhen", "CN", 22.51, 113.88, "Electronics Modules"),
        new Loc("Jabil Shenzhen", "CN", 22.72, 114.21, "Electronics Modules"),
        new Loc("Foxconn Zhengzhou", "CN", 34.74, 113.62, "Semiconductor Assemblies"),
        new Loc("Lenovo Parts Wuhan", "CN", 30.59, 114.30, "Electronics Modules"),
        new Loc("CATL Ningde", "CN", 26.66, 119.54, "Battery Cells"),
        new Loc("Minth Zhejiang", "CN", 29.10, 121.56, "Plastic Components"),
        new Loc("Suncall Dongguan", "CN", 23.02, 113.75, "Steel Components"),
        new Loc("Huawei Dongguan", "CN", 22.90, 113.68, "Semiconductor Assemblies"),
        new Loc("Jabil Guangzhou", "CN", 23.13, 113.26, "Electronics Modules"),
        new Loc("Xinyi Glass Guangzhou", "CN", 23.26, 113.20, "Plastic Components"),
        new Loc("ZTE Parts Shenzhen", "CN", 22.49, 113.99, "Electronics Modules"),
        new Loc("BYD Chengdu", "CN", 30.57, 104.07, "Battery Cells"),
        new Loc("Chengdu Steel Fab", "CN", 30.65, 104.10, "Steel Components"),
        new Loc("SAIC Parts Shanghai", "CN", 31.23, 121.47, "Steel Components"),
        new Loc("Yanfeng Shanghai", "CN", 31.18, 121.59, "Plastic Components"),
        new Loc("Minda Shanghai", "CN", 31.30, 121.35, "Wiring Harnesses"),
        new Loc("Jabil Shanghai", "CN", 31.20, 121.60, "Electronics Modules"),
        new Loc("Sumitomo Suzhou", "CN", 31.30, 120.62, "Wiring Harnesses"),
        new Loc("Boryszew Suzhou", "CN", 31.25, 120.55, "Steel Components"),
        new Loc("Magna Suzhou", "CN", 31.33, 120.65, "Precision Machined Parts"),
        new Loc("Lear Suzhou", "CN", 31.28, 120.60, "Wiring Harnesses"),
        new Loc("Aptiv Suzhou", "CN", 31.22, 120.68, "Wiring Harnesses"),
        new Loc("COSCO Auto Tianjin", "CN", 39.14, 117.18, "Steel Components"),
        new Loc("FAW Parts Tianjin", "CN", 39.08, 117.20, "Precision Machined Parts"),
        new Loc("Toyota Parts Tianjin", "CN", 39.20, 117.15, "Steel Components"),
        new Loc("Tianjin Steel", "CN", 39.12, 117.24, "Steel Components"),
        new Loc("Continental Tianjin", "CN", 39.18, 117.10, "Electronics Modules"),
        new Loc("Qingdao Foundry", "CN", 36.07, 120.38, "Steel Components"),
        new Loc("CRRC Qingdao", "CN", 36.10, 120.45, "Precision Machined Parts"),
        new Loc("Haier Parts Qingdao", "CN", 36.14, 120.30, "Electronics Modules"),
        new Loc("Ningbo Precision", "CN", 29.88, 121.55, "Precision Machined Parts"),
        new Loc("Ningbo Steel", "CN", 29.85, 121.65, "Steel Components"),
        new Loc("Ningbo Plastics", "CN", 29.90, 121.50, "Plastic Components"),
        new Loc("Aurobindo Wuhan", "CN", 30.50, 114.25, "Semiconductor Assemblies"),
        new Loc("CITIC Wuhan", "CN", 30.65, 114.40, "Steel Components"),
        new Loc("Yantai Forging", "CN", 37.47, 121.45, "Steel Components"),
        new Loc("Weifang Parts", "CN", 36.71, 119.10, "Plastic Components"),
        new Loc("Xiamen Electronics", "CN", 24.48, 118.09, "Electronics Modules"),
        new Loc("Fuzhou Components", "CN", 26.08, 119.30, "Precision Machined Parts"),
        new Loc("Changsha Steel", "CN", 28.23, 112.94, "Steel Components"),
        new Loc("Nanjing Auto Parts", "CN", 32.06, 118.78, "Precision Machined Parts"),
        new Loc("Zhengzhou Electronics", "CN", 34.75, 113.65, "Semiconductor Assemblies"),
        new Loc("Xi'an Components", "CN", 34.27, 108.95, "Steel Components"),
        new Loc("Kunming Metals", "CN", 25.05, 102.71, "Steel Components"),
        new Loc("Harbin Tools", "CN", 45.80, 126.54, "Precision Machined Parts"),
        new Loc("Shenyang Steel", "CN", 41.80, 123.43, "Steel Components"),
        new Loc("Dalian Parts", "CN", 38.91, 121.60, "Aluminum Forgings"),
        new Loc("Chongqing Motors", "CN", 29.56, 106.55, "Precision Machined Parts"),
        new Loc("Shantou Plastics", "CN", 23.35, 116.68, "Plastic Components"),
        new Loc("Zhuhai Electronics", "CN", 22.27, 113.56, "Electronics Modules"),
        new Loc("Foshan Ceramics", "CN", 23.02, 113.12, "Precision Machined Parts"),
        new Loc("Taiyuan Steel", "CN", 37.87, 112.55, "Steel Components"),

        // Vietnam (VN) -20 suppliers
        new Loc("Samsung Parts Vietnam", "VN", 10.78, 106.70, "Electronics Modules"),
        new Loc("Foxconn Vietnam", "VN", 21.03, 105.85, "Semiconductor Assemblies"),
        new Loc("LG Vietnam", "VN", 20.86, 106.68, "Electronics Modules"),
        new Loc("Honda Parts Vietnam", "VN", 21.12, 105.77, "Precision Machined Parts"),
        new Loc("Intel Vietnam", "VN", 10.82, 106.68, "Semiconductor Assemblies"),
        new Loc("Bosch Vietnam", "VN", 10.95, 106.72, "Electronics Modules"),
        new Loc("Haiphong Auto", "VN", 20.86, 106.68, "Steel Components"),
        new Loc("Vinfast Parts", "VN", 20.86, 106.52, "Steel Components"),
        new Loc("Hanoi Precision", "VN", 21.03, 105.83, "Precision Machined Parts"),
        new Loc("Da Nang Components", "VN", 16.05, 108.22, "Plastic Components"),
        new Loc("Binh Duong Electronics", "VN", 11.00, 106.65, "Electronics Modules"),
        new Loc("Dong Nai Parts", "VN", 10.97, 106.82, "Plastic Components"),
        new Loc("Can Tho Plastics", "VN", 10.04, 105.79, "Plastic Components"),
        new Loc("Vung Tau Steel", "VN", 10.35, 107.08, "Steel Components"),
        new Loc("Thai Nguyen Steel", "VN", 21.60, 105.85, "Steel Components"),
        new Loc("Bac Ninh Electronics", "VN", 21.18, 106.07, "Electronics Modules"),
        new Loc("Hung Yen Auto", "VN", 20.65, 106.07, "Wiring Harnesses"),
        new Loc("Nam Dinh Textiles", "VN", 20.43, 106.17, "Plastic Components"),
        new Loc("Quang Ngai Steel", "VN", 15.12, 108.80, "Steel Components"),
        new Loc("Hue Components", "VN", 16.46, 107.59, "Precision Machined Parts"),

        // India (IN) -25 suppliers
        new Loc("Bharat Forge Pune", "IN", 18.52, 73.86, "Steel Components"),
        new Loc("Tata Components Chennai", "IN", 13.08, 80.27, "Precision Machined Parts"),
        new Loc("Motherson Noida", "IN", 28.54, 77.39, "Wiring Harnesses"),
        new Loc("Mahindra CIE Pune", "IN", 18.60, 73.78, "Aluminum Forgings"),
        new Loc("Sundram Fasteners Chennai", "IN", 13.09, 80.20, "Precision Machined Parts"),
        new Loc("Tata Steel Jamshedpur", "IN", 22.80, 86.18, "Steel Components"),
        new Loc("Amtek Auto Gurgaon", "IN", 28.45, 77.02, "Steel Components"),
        new Loc("Samvardhana Pune", "IN", 18.58, 73.70, "Plastic Components"),
        new Loc("Lumax Pune", "IN", 18.55, 73.82, "Electronics Modules"),
        new Loc("Bosch Bangalore", "IN", 12.97, 77.59, "Electronics Modules"),
        new Loc("Minda Industries Manesar", "IN", 28.37, 76.94, "Wiring Harnesses"),
        new Loc("Varroc Mumbai", "IN", 19.07, 72.87, "Electronics Modules"),
        new Loc("Endurance Mumbai", "IN", 19.10, 72.90, "Aluminum Forgings"),
        new Loc("Rane Madras Chennai", "IN", 13.05, 80.25, "Precision Machined Parts"),
        new Loc("WABCO India Chennai", "IN", 13.06, 80.22, "Hydraulic Systems"),
        new Loc("Knorr-Bremse Pune", "IN", 18.62, 73.75, "Hydraulic Systems"),
        new Loc("Ceat Tyres Mumbai", "IN", 19.08, 72.85, "Rubber Seals"),
        new Loc("MRF Chennai", "IN", 13.10, 80.28, "Rubber Seals"),
        new Loc("Exide Kolkata", "IN", 22.57, 88.36, "Battery Cells"),
        new Loc("Amara Raja Tirupati", "IN", 13.65, 79.42, "Battery Cells"),
        new Loc("Hikal Ahmedabad", "IN", 23.02, 72.57, "Precision Machined Parts"),
        new Loc("Electrotherm Ahmedabad", "IN", 23.07, 72.60, "Steel Components"),
        new Loc("John Deere Pune", "IN", 18.50, 73.90, "Hydraulic Systems"),
        new Loc("ABB Vadodara", "IN", 22.30, 73.19, "Electronics Modules"),
        new Loc("Siemens Chennai", "IN", 13.07, 80.26, "Electronics Modules"),

        // Korea (KR) -20 suppliers
        new Loc("Samsung SDI Cheonan", "KR", 36.81, 127.15, "Battery Cells"),
        new Loc("LG Chem Seoul", "KR", 37.57, 126.98, "Battery Cells"),
        new Loc("Hyundai Mobis Ulsan", "KR", 35.54, 129.31, "Hydraulic Systems"),
        new Loc("Hankook Tire Seoul", "KR", 37.52, 126.95, "Rubber Seals"),
        new Loc("Samsung Parts Incheon", "KR", 37.46, 126.70, "Electronics Modules"),
        new Loc("LG Electronics Gumi", "KR", 36.11, 128.34, "Electronics Modules"),
        new Loc("HL Mando Pyeongtaek", "KR", 36.99, 127.11, "Hydraulic Systems"),
        new Loc("SL Corp Gyeongsan", "KR", 35.82, 128.74, "Wiring Harnesses"),
        new Loc("Seoyon E-Hwa Incheon", "KR", 37.40, 126.68, "Plastic Components"),
        new Loc("DY Corp Cheongju", "KR", 36.64, 127.49, "Precision Machined Parts"),
        new Loc("Hyundai Steel Dangjin", "KR", 36.89, 126.63, "Steel Components"),
        new Loc("POSCO Pohang", "KR", 36.02, 129.34, "Steel Components"),
        new Loc("Doosan Changwon", "KR", 35.24, 128.68, "Hydraulic Systems"),
        new Loc("Hysco Busan", "KR", 35.18, 129.07, "Steel Components"),
        new Loc("Kepco Daejeon", "KR", 36.35, 127.38, "Electronics Modules"),
        new Loc("Kortek Daegu", "KR", 35.87, 128.60, "Electronics Modules"),
        new Loc("Hyundai Wia Changwon", "KR", 35.23, 128.65, "Precision Machined Parts"),
        new Loc("KG Mobility Pyeongtaek", "KR", 37.00, 127.07, "Steel Components"),
        new Loc("Sewon Parts Incheon", "KR", 37.44, 126.62, "Aluminum Forgings"),
        new Loc("Sung Woo Iksan", "KR", 35.95, 126.95, "Plastic Components"),

        // Mexico (MX) -20 suppliers
        new Loc("Nemak Monterrey", "MX", 25.68, -100.31, "Aluminum Forgings"),
        new Loc("Ternium Monterrey", "MX", 25.72, -100.22, "Steel Components"),
        new Loc("KS Autotech Querétaro", "MX", 20.59, -100.39, "Precision Machined Parts"),
        new Loc("Yazaki Juárez", "MX", 31.73, -106.49, "Wiring Harnesses"),
        new Loc("Delphi Juárez", "MX", 31.69, -106.43, "Wiring Harnesses"),
        new Loc("Remy Tijuana", "MX", 32.50, -117.03, "Electronics Modules"),
        new Loc("Flex Tijuana", "MX", 32.53, -116.98, "Electronics Modules"),
        new Loc("Sumitomo Reynosa", "MX", 26.09, -98.28, "Wiring Harnesses"),
        new Loc("Aptiv Salamanca", "MX", 20.57, -101.19, "Wiring Harnesses"),
        new Loc("Continental Silao", "MX", 20.93, -101.43, "Electronics Modules"),
        new Loc("Bosch Guadalajara", "MX", 20.67, -103.35, "Hydraulic Systems"),
        new Loc("Vitro San Luis Potosí", "MX", 22.15, -100.97, "Plastic Components"),
        new Loc("Mabe Celaya", "MX", 20.52, -100.81, "Precision Machined Parts"),
        new Loc("Metalsa Monterrey", "MX", 25.70, -100.25, "Steel Components"),
        new Loc("TREMEC Querétaro", "MX", 20.62, -100.38, "Precision Machined Parts"),
        new Loc("Galaz Chihuahua", "MX", 28.63, -106.07, "Plastic Components"),
        new Loc("VITSA Saltillo", "MX", 25.43, -100.99, "Rubber Seals"),
        new Loc("Driv Puebla", "MX", 19.04, -98.20, "Aluminum Forgings"),
        new Loc("Tecma Matamoros", "MX", 25.87, -97.50, "Wiring Harnesses"),
        new Loc("Flex Hermosillo", "MX", 29.07, -110.95, "Electronics Modules"),

        // Poland (PL) -15 suppliers
        new Loc("Magna Poland Warsaw", "PL", 52.23, 21.01, "Steel Components"),
        new Loc("Delphi Wroclaw", "PL", 51.11, 17.02, "Precision Machined Parts"),
        new Loc("Boryszew Krakow", "PL", 50.06, 19.94, "Electronics Modules"),
        new Loc("Valeo Poznan", "PL", 52.40, 16.93, "Electronics Modules"),
        new Loc("Faurecia Walbrzych", "PL", 50.77, 16.28, "Plastic Components"),
        new Loc("TRW Czestochowa", "PL", 50.81, 19.12, "Hydraulic Systems"),
        new Loc("Marposs Gdansk", "PL", 54.35, 18.65, "Precision Machined Parts"),
        new Loc("Automotive Lighting Bielsko", "PL", 49.82, 19.05, "Electronics Modules"),
        new Loc("Eaton Lodz", "PL", 51.76, 19.46, "Hydraulic Systems"),
        new Loc("Nexteer Tychy", "PL", 50.13, 18.99, "Hydraulic Systems"),
        new Loc("Kirchhoff Gorzow", "PL", 52.73, 15.24, "Steel Components"),
        new Loc("Knorr Bremse Wroclaw", "PL", 51.09, 16.98, "Hydraulic Systems"),
        new Loc("Kuehne Lublin", "PL", 51.25, 22.57, "Precision Machined Parts"),
        new Loc("Sanmina Bialystok", "PL", 53.13, 23.16, "Electronics Modules"),
        new Loc("Aptiv Krosno", "PL", 49.69, 21.77, "Wiring Harnesses"),

        // Taiwan (TW) -15 suppliers
        new Loc("TSMC Taipei", "TW", 25.03, 121.56, "Semiconductor Assemblies"),
        new Loc("Foxconn Taipei", "TW", 25.08, 121.53, "Electronics Modules"),
        new Loc("Pegatron Taipei", "TW", 25.10, 121.51, "Electronics Modules"),
        new Loc("Wistron Taipei", "TW", 25.05, 121.57, "Semiconductor Assemblies"),
        new Loc("Quanta Taoyuan", "TW", 25.00, 121.30, "Electronics Modules"),
        new Loc("Delta Electronics Taoyuan", "TW", 24.98, 121.25, "Electronics Modules"),
        new Loc("ASUS Taipei", "TW", 25.07, 121.55, "Electronics Modules"),
        new Loc("Compal Taipei", "TW", 25.02, 121.60, "Electronics Modules"),
        new Loc("MediaTek Hsinchu", "TW", 24.80, 120.97, "Semiconductor Assemblies"),
        new Loc("AUO Longtan", "TW", 24.85, 121.22, "Semiconductor Assemblies"),
        new Loc("CMC Kaohsiung", "TW", 22.63, 120.30, "Steel Components"),
        new Loc("CSC Kaohsiung", "TW", 22.61, 120.25, "Steel Components"),
        new Loc("Walsin Taichung", "TW", 24.15, 120.67, "Wiring Harnesses"),
        new Loc("Yageo Taipei", "TW", 25.04, 121.50, "Electronics Modules"),
        new Loc("TDK Taipei", "TW", 25.09, 121.54, "Electronics Modules"),

        // Malaysia (MY) -10 suppliers
        new Loc("Intel Penang", "MY", 5.41, 100.33, "Semiconductor Assemblies"),
        new Loc("Motorola Penang", "MY", 5.38, 100.30, "Electronics Modules"),
        new Loc("Robert Bosch Penang", "MY", 5.43, 100.37, "Electronics Modules"),
        new Loc("Jabil Penang", "MY", 5.40, 100.35, "Electronics Modules"),
        new Loc("Flextronics Petaling Jaya", "MY", 3.11, 101.64, "Electronics Modules"),
        new Loc("Perodua Parts Rawang", "MY", 3.32, 101.58, "Plastic Components"),
        new Loc("Proton Parts Shah Alam", "MY", 3.08, 101.52, "Steel Components"),
        new Loc("Panasonic Johor Bahru", "MY", 1.49, 103.74, "Electronics Modules"),
        new Loc("Western Digital Johor Bahru", "MY", 1.52, 103.72, "Semiconductor Assemblies"),
        new Loc("Infineon Malacca", "MY", 2.21, 102.25, "Semiconductor Assemblies"),

        // Thailand (TH) -10 suppliers
        new Loc("Western Digital Ayutthaya", "TH", 14.35, 100.57, "Semiconductor Assemblies"),
        new Loc("Toyota Parts Samut Prakan", "TH", 13.60, 100.61, "Precision Machined Parts"),
        new Loc("Thai Summit Rayong", "TH", 12.68, 101.28, "Plastic Components"),
        new Loc("Aapico Chachoengsao", "TH", 13.69, 101.08, "Steel Components"),
        new Loc("Summit Parts Bangkok", "TH", 13.75, 100.52, "Aluminum Forgings"),
        new Loc("DENSO Chonburi", "TH", 13.36, 100.99, "Electronics Modules"),
        new Loc("Bridgestone Chonburi", "TH", 13.42, 101.05, "Rubber Seals"),
        new Loc("TPI Polene Saraburi", "TH", 14.53, 100.92, "Plastic Components"),
        new Loc("GS Battery Nakhon Ratchasima", "TH", 14.97, 102.10, "Battery Cells"),
        new Loc("Hana Micro Chiang Mai", "TH", 18.78, 98.99, "Semiconductor Assemblies"),

        // Bangladesh (BD) -5 suppliers
        new Loc("Ananta Dhaka", "BD", 23.81, 90.41, "Plastic Components"),
        new Loc("DBL Group Dhaka", "BD", 23.83, 90.37, "Wiring Harnesses"),
        new Loc("Youngone Chittagong", "BD", 22.36, 91.80, "Plastic Components"),
        new Loc("Ha-Meem Narayanganj", "BD", 23.62, 90.50, "Plastic Components"),
        new Loc("MBM Gazipur", "BD", 23.99, 90.42, "Wiring Harnesses"),

        // Turkey (TR) -5 suppliers
        new Loc("Ford Otosan Istanbul", "TR", 41.01, 28.96, "Precision Machined Parts"),
        new Loc("Tofas Bursa", "TR", 40.19, 29.07, "Steel Components"),
        new Loc("Valeo Istanbul", "TR", 41.08, 29.00, "Electronics Modules"),
        new Loc("Bosch Bursa", "TR", 40.22, 29.04, "Hydraulic Systems"),
        new Loc("Arcelik Istanbul", "TR", 40.98, 28.88, "Electronics Modules"),

        // Germany (DE) -5 suppliers
        new Loc("Bosch Stuttgart", "DE", 48.78, 9.18, "Hydraulic Systems"),
        new Loc("Continental Hanover", "DE", 52.37, 9.73, "Electronics Modules"),
        new Loc("ZF Friedrichshafen", "DE", 47.65, 9.48, "Precision Machined Parts"),
        new Loc("Schaeffler Herzogenaurach", "DE", 49.57, 10.89, "Precision Machined Parts"),
        new Loc("Mahle Stuttgart", "DE", 48.80, 9.20, "Aluminum Forgings"),
    };

    private static readonly Loc[] Plants = new[]
    {
        // USA (9)
        new Loc("Detroit MI", "US", 42.33, -83.05),
        new Loc("Atlanta GA", "US", 33.75, -84.39),
        new Loc("Houston TX", "US", 29.76, -95.37),
        new Loc("Chicago IL", "US", 41.88, -87.63),
        new Loc("Los Angeles CA", "US", 34.05, -118.24),
        new Loc("Columbus OH", "US", 39.96, -82.99),
        new Loc("Louisville KY", "US", 38.25, -85.76),
        new Loc("Nashville TN", "US", 36.17, -86.78),
        new Loc("San Antonio TX", "US", 29.43, -98.49),
        // Germany (3)
        new Loc("Stuttgart DE", "DE", 48.78, 9.18),
        new Loc("Munich DE", "DE", 48.14, 11.58),
        new Loc("Cologne DE", "DE", 50.94, 6.96),
        // France (2)
        new Loc("Lyon FR", "FR", 45.75, 4.84),
        new Loc("Paris FR", "FR", 48.85, 2.35),
        // Mexico (3)
        new Loc("Monterrey MX", "MX", 25.68, -100.31),
        new Loc("Juarez MX", "MX", 31.73, -106.49),
        new Loc("Guadalajara MX", "MX", 20.67, -103.35),
        // Japan (2)
        new Loc("Tokyo JP", "JP", 35.69, 139.69),
        new Loc("Osaka JP", "JP", 34.69, 135.50),
        // Korea (2)
        new Loc("Seoul KR", "KR", 37.56, 126.98),
        new Loc("Busan KR", "KR", 35.18, 129.07),
        // India (2)
        new Loc("Chennai IN", "IN", 13.08, 80.27),
        new Loc("Pune IN", "IN", 18.52, 73.86),
        // China (2)
        new Loc("Shanghai CN", "CN", 31.23, 121.47),
        new Loc("Chengdu CN", "CN", 30.57, 104.07),
        // Brazil (1)
        new Loc("São Paulo BR", "BR", -23.55, -46.63),
    };

    private static readonly Loc[] DCs = new[]
    {
        // USA (25 DCs)
        new Loc("Memphis TN DC", "US", 35.15, -90.05),
        new Loc("Dallas TX DC", "US", 32.78, -96.80),
        new Loc("Phoenix AZ DC", "US", 33.45, -112.07),
        new Loc("Indianapolis IN DC", "US", 39.77, -86.16),
        new Loc("Louisville KY DC", "US", 38.23, -85.73),
        new Loc("Seattle WA DC", "US", 47.61, -122.33),
        new Loc("Denver CO DC", "US", 39.74, -104.99),
        new Loc("Kansas City MO DC", "US", 39.10, -94.58),
        new Loc("Miami FL DC", "US", 25.77, -80.19),
        new Loc("Charlotte NC DC", "US", 35.23, -80.84),
        new Loc("Philadelphia PA DC", "US", 39.95, -75.17),
        new Loc("Baltimore MD DC", "US", 39.29, -76.61),
        new Loc("Minneapolis MN DC", "US", 44.98, -93.27),
        new Loc("Portland OR DC", "US", 45.52, -122.68),
        new Loc("Salt Lake City UT DC", "US", 40.76, -111.89),
        new Loc("Albuquerque NM DC", "US", 35.08, -106.65),
        new Loc("Cincinnati OH DC", "US", 39.10, -84.51),
        new Loc("San Jose CA DC", "US", 37.34, -121.89),
        new Loc("San Diego CA DC", "US", 32.72, -117.16),
        new Loc("Reno NV DC", "US", 39.53, -119.81),
        new Loc("Jacksonville FL DC", "US", 30.33, -81.66),
        new Loc("St Louis MO DC", "US", 38.63, -90.20),
        new Loc("Columbus OH DC", "US", 39.97, -82.97),
        new Loc("Richmond VA DC", "US", 37.54, -77.43),
        new Loc("Hartford CT DC", "US", 41.76, -72.68),

        // Europe (20 DCs)
        new Loc("Rotterdam NL DC", "NL", 51.92, 4.48),
        new Loc("Antwerp BE DC", "BE", 51.22, 4.40),
        new Loc("Frankfurt DE DC", "DE", 50.11, 8.68),
        new Loc("Berlin DE DC", "DE", 52.52, 13.40),
        new Loc("Hamburg DE DC", "DE", 53.55, 9.99),
        new Loc("Brussels BE DC", "BE", 50.85, 4.35),
        new Loc("Lyon FR DC", "FR", 45.73, 4.81),
        new Loc("Madrid ES DC", "ES", 40.42, -3.70),
        new Loc("Milan IT DC", "IT", 45.46, 9.19),
        new Loc("Warsaw PL DC", "PL", 52.23, 21.01),
        new Loc("Prague CZ DC", "CZ", 50.08, 14.44),
        new Loc("Vienna AT DC", "AT", 48.21, 16.37),
        new Loc("Budapest HU DC", "HU", 47.50, 19.04),
        new Loc("Barcelona ES DC", "ES", 41.39, 2.15),
        new Loc("Manchester UK DC", "GB", 53.48, -2.24),
        new Loc("Birmingham UK DC", "GB", 52.48, -1.89),
        new Loc("Gothenburg SE DC", "SE", 57.71, 11.97),
        new Loc("Zurich CH DC", "CH", 47.38, 8.54),
        new Loc("Bucharest RO DC", "RO", 44.43, 26.10),
        new Loc("Lisbon PT DC", "PT", 38.72, -9.14),

        // Asia-Pacific (15 DCs)
        new Loc("Singapore DC", "SG", 1.35, 103.82),
        new Loc("Hong Kong DC", "HK", 22.33, 114.17),
        new Loc("Tokyo DC", "JP", 35.68, 139.69),
        new Loc("Seoul DC", "KR", 37.55, 126.98),
        new Loc("Bangkok DC", "TH", 13.76, 100.50),
        new Loc("Kuala Lumpur DC", "MY", 3.15, 101.69),
        new Loc("Jakarta DC", "ID", -6.21, 106.85),
        new Loc("Melbourne DC", "AU", -37.81, 144.96),
        new Loc("Sydney DC", "AU", -33.87, 151.21),
        new Loc("Taipei DC", "TW", 25.04, 121.56),
        new Loc("Guangzhou DC", "CN", 23.13, 113.26),
        new Loc("Chengdu DC", "CN", 30.57, 104.07),
        new Loc("Beijing DC", "CN", 39.90, 116.41),
        new Loc("Shanghai DC", "CN", 31.23, 121.47),
        new Loc("Osaka DC", "JP", 34.70, 135.50),

        // Mexico (5 DCs)
        new Loc("Mexico City DC", "MX", 19.43, -99.13),
        new Loc("Monterrey DC", "MX", 25.69, -100.32),
        new Loc("Guadalajara DC", "MX", 20.68, -103.37),
        new Loc("Tijuana DC", "MX", 32.52, -117.02),
        new Loc("Puebla DC", "MX", 19.04, -98.20),

        // Canada (5 DCs)
        new Loc("Toronto ON DC", "CA", 43.70, -79.42),
        new Loc("Vancouver BC DC", "CA", 49.25, -123.12),
        new Loc("Calgary AB DC", "CA", 51.05, -114.08),
        new Loc("Montreal QC DC", "CA", 45.50, -73.57),
        new Loc("Windsor ON DC", "CA", 42.31, -83.03),

        // Brazil (5 DCs)
        new Loc("São Paulo DC", "BR", -23.54, -46.64),
        new Loc("Rio de Janeiro DC", "BR", -22.91, -43.17),
        new Loc("Belo Horizonte DC", "BR", -19.92, -43.94),
        new Loc("Curitiba DC", "BR", -25.43, -49.27),
        new Loc("Porto Alegre DC", "BR", -30.03, -51.23),

        // India (5 DCs)
        new Loc("Mumbai DC", "IN", 19.08, 72.88),
        new Loc("Delhi DC", "IN", 28.63, 77.22),
        new Loc("Bangalore DC", "IN", 12.97, 77.59),
        new Loc("Hyderabad DC", "IN", 17.39, 78.49),
        new Loc("Kolkata DC", "IN", 22.57, 88.36),
    };

    private static readonly Loc[] Ports = new[]
    {
        // Asia
        new Loc("Shanghai Port", "CN", 31.23, 121.55),
        new Loc("Ningbo Port", "CN", 29.86, 121.55),
        new Loc("Shenzhen Port", "CN", 22.49, 114.11),
        new Loc("Guangzhou Port", "CN", 23.09, 113.29),
        new Loc("Qingdao Port", "CN", 36.07, 120.33),
        new Loc("Tianjin Port", "CN", 38.99, 117.72),
        new Loc("Busan Port", "KR", 35.11, 129.04),
        new Loc("Kaohsiung Port", "TW", 22.61, 120.28),
        new Loc("Yokohama Port", "JP", 35.44, 139.64),
        new Loc("JNPT Mumbai", "IN", 18.95, 72.95),
        new Loc("Chennai Port", "IN", 13.09, 80.30),
        new Loc("Singapore Port", "SG", 1.28, 103.86),
        new Loc("Port Klang", "MY", 3.00, 101.39),
        new Loc("Laem Chabang", "TH", 13.08, 100.88),
        new Loc("Ho Chi Minh Port", "VN", 10.73, 106.70),
        // Europe
        new Loc("Rotterdam Port", "NL", 51.93, 4.14),
        new Loc("Hamburg Port", "DE", 53.54, 9.97),
        new Loc("Antwerp Port", "BE", 51.25, 4.38),
        new Loc("Felixstowe Port", "GB", 51.96, 1.35),
        new Loc("Marseille Port", "FR", 43.30, 5.35),
        new Loc("Mersin Port", "TR", 36.80, 34.62),
        // Americas
        new Loc("Los Angeles Port", "US", 33.72, -118.28),
        new Loc("New York Port", "US", 40.66, -74.04),
        new Loc("Houston Port", "US", 29.73, -95.02),
        new Loc("Savannah Port", "US", 32.10, -81.10),
    };

    private static readonly string[] Categories = new[]
    {
        "Electronics Modules", "Steel Components", "Compressor Units", "Plastic Components",
        "Semiconductor Assemblies", "Aluminum Forgings", "Battery Cells", "Wiring Harnesses",
        "Hydraulic Systems", "Precision Machined Parts", "Rubber Seals",
    };

    private static readonly string[] OceanCarriers = { "ONE", "MSC", "Hapag-Lloyd", "Evergreen", "COSCO", "CMA CGM", "Maersk" };
    private static readonly string[] RoadCarriers  = { "Werner", "Schneider", "JB Hunt", "Penske", "Swift", "Old Dominion", "XPO", "DB Schenker", "DSV", "Kuehne Nagel", "Transplace", "Ryder" };
    private static readonly string[] RailCarriers  = { "Union Pacific", "BNSF", "Norfolk Southern", "CSX", "CN Rail", "CP Rail" };
    private static readonly string[] AirCarriers   = { "FedEx Freight", "UPS Supply Chain", "DHL Aviation", "Cargolux", "Lufthansa Cargo" };

    // ── main entry point ────────────────────────────────────────────────────

    public static Dictionary<string, object?> Generate()
    {
        var rng = new Random(42);

        var laneRows    = new List<object?>();
        var nodeRows    = new List<object?>();
        var supplierRows = new List<object?>();
        var plantRows   = new List<object?>();
        var dcRows      = new List<object?>();
        int laneId = 0;

        // ── build nodes lookup ───────────────────────────────────────────
        var allLocs = new List<(Loc loc, string role)>();
        foreach (var s in Suppliers)  allLocs.Add((s, "supplier"));
        foreach (var p in Plants)     allLocs.Add((p, "plant"));
        foreach (var d in DCs)        allLocs.Add((d, "dc"));
        foreach (var pt in Ports)     allLocs.Add((pt, "port"));

        var nodeSet = new HashSet<string>();
        void AddNode(Loc l, string role)
        {
            if (!nodeSet.Add(l.Name)) return;
            nodeRows.Add(MakeRow("name", l.Name, "country", l.Country, "lat", l.Lat, "lng", l.Lng, "role", role));
        }
        foreach (var (loc, role) in allLocs) AddNode(loc, role);

        // ── suppliers master ─────────────────────────────────────────────
        int sIdx = 1;
        foreach (var s in Suppliers)
        {
            string cat = s.Category ?? Pick(rng, Categories);
            supplierRows.Add(MakeRow(
                "Supplier_ID", $"SUP-{sIdx:D3}",
                "Supplier_Name", s.Name,
                "City", s.Name.Split(' ').Last(),
                "Country", s.Country,
                "Product_Category", cat,
                "Annual_Volume_Units", 30000 + rng.Next(0, 120000),
                "Lead_Time_Days", 10 + rng.Next(0, 45),
                "Annual_Spend_USD", 5_000_000.0 + rng.Next(0, 90_000_000),
                "Risk_Score", Math.Round(0.1 + rng.NextDouble() * 0.7, 2)
            ));
            sIdx++;
        }

        // ── plants master ────────────────────────────────────────────────
        int pIdx = 1;
        foreach (var p in Plants)
        {
            plantRows.Add(MakeRow(
                "Plant_ID", $"PLT-{pIdx:D3}",
                "Plant_Name", p.Name,
                "Country", p.Country,
                "lat", p.Lat, "lng", p.Lng,
                "Capacity_Units", 200_000 + rng.Next(0, 600_000),
                "Utilization_Pct", Math.Round(60.0 + rng.NextDouble() * 35.0, 1)
            ));
            pIdx++;
        }

        // ── DCs master ───────────────────────────────────────────────────
        int dIdx = 1;
        foreach (var d in DCs)
        {
            dcRows.Add(MakeRow(
                "DC_ID", $"DC-{dIdx:D3}",
                "DC_Name", d.Name,
                "Country", d.Country,
                "lat", d.Lat, "lng", d.Lng,
                "Throughput_Units", 100_000 + rng.Next(0, 500_000),
                "Utilization_Pct", Math.Round(50.0 + rng.NextDouble() * 40.0, 1)
            ));
            dIdx++;
        }

        // ── helper: assign port for supplier ────────────────────────────
        Loc[] PortsForSupplier(Loc sup)
        {
            return sup.Country switch
            {
                "CN" => PickN(rng, new[] { Ports[0], Ports[1], Ports[2], Ports[3], Ports[4], Ports[5] }, 2),
                "VN" => PickN(rng, new[] { Ports[14] }, 1),
                "IN" => PickN(rng, new[] { Ports[9], Ports[10] }, 1),
                "KR" => PickN(rng, new[] { Ports[6] }, 1),
                "TW" => PickN(rng, new[] { Ports[7] }, 1),
                "TH" => PickN(rng, new[] { Ports[13] }, 1),
                "MY" => PickN(rng, new[] { Ports[12] }, 1),
                "BD" => PickN(rng, new[] { Ports[10] }, 1),
                "TR" => PickN(rng, new[] { Ports[20] }, 1),
                "DE" or "PL" => PickN(rng, new[] { Ports[15], Ports[16], Ports[17] }, 1),
                _ => Array.Empty<Loc>(),
            };
        }

        // ── Supplier → Port lanes ────────────────────────────────────────
        foreach (var sup in Suppliers)
        {
            var supPorts = PortsForSupplier(sup);
            foreach (var port in supPorts)
            {
                string mode = sup.Country is "MX" or "DE" or "PL" ? "road" : "ocean";
                if (sup.Country is "DE" or "PL") mode = rng.NextDouble() < 0.6 ? "road" : "rail";

                double dist = Haversine(sup.Lat, sup.Lng, port.Lat, port.Lng);
                dist = Math.Max(dist, 80);
                double weight = 2000 + rng.Next(0, 18000);
                int ships = ShipsPerYear(rng, "Supplier→Port");
                double freight = FreightPerShipment(rng, mode, dist, weight);
                int transit = TransitDays(rng, mode, dist);
                double otif = OtifPct(rng, mode);
                string carrier = CarrierFor(rng, mode);
                string cat = sup.Category ?? Pick(rng, Categories);

                laneRows.Add(LaneRow(laneId++, sup, port, "Supplier→Port", mode,
                    dist, weight, ships, freight, transit, otif, carrier, cat));
            }
        }

        // ── Port → Plant lanes ───────────────────────────────────────────
        // Each port connects to reachable plants (same continent or intercontinental)
        foreach (var port in Ports)
        {
            var targets = Plants.OrderBy(_ => rng.Next()).Take(8 + rng.Next(0, 8)).ToArray();
            foreach (var plant in targets)
            {
                string mode = "ocean";
                double dist = Haversine(port.Lat, port.Lng, plant.Lat, plant.Lng);
                if (dist < 1200) mode = rng.NextDouble() < 0.5 ? "road" : "rail";

                double weight = 4000 + rng.Next(0, 20000);
                int ships = ShipsPerYear(rng, "Port→Plant");
                double freight = FreightPerShipment(rng, mode, dist, weight);
                int transit = TransitDays(rng, mode, dist);
                double otif = OtifPct(rng, mode);
                string carrier = CarrierFor(rng, mode);
                string cat = Pick(rng, Categories);

                laneRows.Add(LaneRow(laneId++, port, plant, "Port→Plant", mode,
                    dist, weight, ships, freight, transit, otif, carrier, cat));
            }
        }

        // ── Supplier → Plant (direct) lanes ─────────────────────────────
        // MX→US, DE/PL→EU plants direct; some others short haul
        foreach (var sup in Suppliers)
        {
            Loc[] directPlants;
            if (sup.Country == "MX")
                directPlants = Plants.Where(p => p.Country == "US").ToArray();
            else if (sup.Country is "DE" or "PL")
                directPlants = Plants.Where(p => p.Country is "DE" or "FR").ToArray();
            else if (sup.Country == "IN")
                directPlants = Plants.Where(p => p.Country == "IN").ToArray();
            else if (sup.Country is "KR")
                directPlants = Plants.Where(p => p.Country is "KR").ToArray();
            else if (sup.Country is "CN")
                directPlants = Plants.Where(p => p.Country is "CN").OrderBy(_ => rng.Next()).Take(2).ToArray();
            else
                continue;

            foreach (var plant in directPlants.OrderBy(_ => rng.Next()).Take(3))
            {
                double dist = Haversine(sup.Lat, sup.Lng, plant.Lat, plant.Lng);
                dist = Math.Max(dist, 100);
                string mode = dist > 800 ? "ocean" : (rng.NextDouble() < 0.6 ? "road" : "rail");
                double weight = 3000 + rng.Next(0, 12000);
                int ships = ShipsPerYear(rng, "Supplier→Plant");
                double freight = FreightPerShipment(rng, mode, dist, weight);
                int transit = TransitDays(rng, mode, dist);
                double otif = OtifPct(rng, mode);
                string carrier = CarrierFor(rng, mode);
                string cat = sup.Category ?? Pick(rng, Categories);

                laneRows.Add(LaneRow(laneId++, sup, plant, "Supplier→Plant", mode,
                    dist, weight, ships, freight, transit, otif, carrier, cat));
            }
        }

        // ── Plant → Plant lanes ──────────────────────────────────────────
        for (int i = 0; i < Plants.Length; i++)
        {
            var from = Plants[i];
            var toSet = Plants.Where((_, j) => j != i)
                              .OrderBy(_ => rng.Next()).Take(3 + rng.Next(0, 5)).ToArray();
            foreach (var to in toSet)
            {
                double dist = Haversine(from.Lat, from.Lng, to.Lat, to.Lng);
                dist = Math.Max(dist, 200);
                string mode = dist > 3000 ? "ocean" : (rng.NextDouble() < 0.5 ? "road" : "rail");
                double weight = 5000 + rng.Next(0, 25000);
                int ships = ShipsPerYear(rng, "Plant→Plant");
                double freight = FreightPerShipment(rng, mode, dist, weight);
                int transit = TransitDays(rng, mode, dist);
                double otif = OtifPct(rng, mode);
                string carrier = CarrierFor(rng, mode);
                string cat = Pick(rng, Categories);

                laneRows.Add(LaneRow(laneId++, from, to, "Plant→Plant", mode,
                    dist, weight, ships, freight, transit, otif, carrier, cat));
            }
        }

        // ── Plant → DC lanes ─────────────────────────────────────────────
        foreach (var plant in Plants)
        {
            // Each plant feeds a meaningful subset of DCs
            var dcSubset = DCs.OrderBy(_ => rng.Next()).Take(24 + rng.Next(0, 20)).ToArray();
            foreach (var dc in dcSubset)
            {
                double dist = Haversine(plant.Lat, plant.Lng, dc.Lat, dc.Lng);
                dist = Math.Max(dist, 80);
                string mode = dist > 4000 ? "ocean" : (rng.NextDouble() < 0.15 ? "air" : (dist > 600 && rng.NextDouble() < 0.3 ? "rail" : "road"));
                double weight = 1000 + rng.Next(0, 8000);
                int ships = ShipsPerYear(rng, "Plant→DC");
                double freight = FreightPerShipment(rng, mode, dist, weight);
                int transit = TransitDays(rng, mode, dist);
                double otif = OtifPct(rng, mode);
                string carrier = CarrierFor(rng, mode);
                string cat = Pick(rng, Categories);

                laneRows.Add(LaneRow(laneId++, plant, dc, "Plant→DC", mode,
                    dist, weight, ships, freight, transit, otif, carrier, cat));
            }
        }

        // ── DC → DC lanes ────────────────────────────────────────────────
        for (int i = 0; i < DCs.Length; i += 4)
        {
            var from = DCs[i];
            var toSet = DCs.Where((_, j) => j != i && j % 4 == 1)
                           .OrderBy(_ => rng.Next()).Take(3).ToArray();
            foreach (var to in toSet)
            {
                double dist = Haversine(from.Lat, from.Lng, to.Lat, to.Lng);
                dist = Math.Max(dist, 200);
                string mode = dist > 3000 ? "ocean" : "road";
                double weight = 500 + rng.Next(0, 5000);
                int ships = ShipsPerYear(rng, "DC→DC");
                double freight = FreightPerShipment(rng, mode, dist, weight);
                int transit = TransitDays(rng, mode, dist);
                double otif = OtifPct(rng, mode);
                string carrier = CarrierFor(rng, mode);
                string cat = Pick(rng, Categories);

                laneRows.Add(LaneRow(laneId++, from, to, "DC→DC", mode,
                    dist, weight, ships, freight, transit, otif, carrier, cat));
            }
        }

        // ── categories, trade, financial, contracts ──────────────────────
        var categoryRows = new List<object?>();
        foreach (var c in Categories)
            categoryRows.Add(MakeRow("name", c, "category_id", c.Substring(0, 4).ToUpper()));

        var tradeRows = new List<object?>();
        tradeRows.AddRange(new object?[]
        {
            MakeRow("Origin_Country","CN","Destination_Country","US","Duty_Rate_Pct",3.5,"Tariff_Rate_Pct",25.0,"FTA","None"),
            MakeRow("Origin_Country","VN","Destination_Country","US","Duty_Rate_Pct",3.5,"Tariff_Rate_Pct",0.0,"FTA","None"),
            MakeRow("Origin_Country","MX","Destination_Country","US","Duty_Rate_Pct",2.0,"Tariff_Rate_Pct",0.0,"FTA","USMCA"),
            MakeRow("Origin_Country","IN","Destination_Country","US","Duty_Rate_Pct",4.0,"Tariff_Rate_Pct",0.0,"FTA","None"),
            MakeRow("Origin_Country","KR","Destination_Country","US","Duty_Rate_Pct",3.0,"Tariff_Rate_Pct",0.0,"FTA","KORUS"),
            MakeRow("Origin_Country","TW","Destination_Country","US","Duty_Rate_Pct",3.5,"Tariff_Rate_Pct",7.5,"FTA","None"),
            MakeRow("Origin_Country","TH","Destination_Country","US","Duty_Rate_Pct",3.5,"Tariff_Rate_Pct",0.0,"FTA","None"),
            MakeRow("Origin_Country","MY","Destination_Country","US","Duty_Rate_Pct",3.0,"Tariff_Rate_Pct",0.0,"FTA","None"),
            MakeRow("Origin_Country","BD","Destination_Country","US","Duty_Rate_Pct",4.0,"Tariff_Rate_Pct",0.0,"FTA","None"),
            MakeRow("Origin_Country","TR","Destination_Country","US","Duty_Rate_Pct",3.5,"Tariff_Rate_Pct",0.0,"FTA","None"),
            MakeRow("Origin_Country","DE","Destination_Country","US","Duty_Rate_Pct",2.5,"Tariff_Rate_Pct",0.0,"FTA","None"),
            MakeRow("Origin_Country","PL","Destination_Country","US","Duty_Rate_Pct",2.5,"Tariff_Rate_Pct",0.0,"FTA","None"),
            MakeRow("Origin_Country","CN","Destination_Country","DE","Duty_Rate_Pct",4.0,"Tariff_Rate_Pct",6.5,"FTA","None"),
            MakeRow("Origin_Country","IN","Destination_Country","DE","Duty_Rate_Pct",4.0,"Tariff_Rate_Pct",6.0,"FTA","None"),
            MakeRow("Origin_Country","MX","Destination_Country","DE","Duty_Rate_Pct",2.5,"Tariff_Rate_Pct",0.0,"FTA","None"),
            MakeRow("Origin_Country","CN","Destination_Country","FR","Duty_Rate_Pct",4.0,"Tariff_Rate_Pct",6.5,"FTA","None"),
            MakeRow("Origin_Country","PL","Destination_Country","DE","Duty_Rate_Pct",0.0,"Tariff_Rate_Pct",0.0,"FTA","EU"),
            MakeRow("Origin_Country","DE","Destination_Country","FR","Duty_Rate_Pct",0.0,"Tariff_Rate_Pct",0.0,"FTA","EU"),
            MakeRow("Origin_Country","CN","Destination_Country","JP","Duty_Rate_Pct",3.0,"Tariff_Rate_Pct",5.0,"FTA","None"),
            MakeRow("Origin_Country","KR","Destination_Country","JP","Duty_Rate_Pct",2.5,"Tariff_Rate_Pct",0.0,"FTA","None"),
            MakeRow("Origin_Country","VN","Destination_Country","JP","Duty_Rate_Pct",2.5,"Tariff_Rate_Pct",0.0,"FTA","None"),
            MakeRow("Origin_Country","CN","Destination_Country","KR","Duty_Rate_Pct",3.0,"Tariff_Rate_Pct",4.0,"FTA","None"),
            MakeRow("Origin_Country","IN","Destination_Country","KR","Duty_Rate_Pct",3.5,"Tariff_Rate_Pct",5.0,"FTA","None"),
            MakeRow("Origin_Country","CN","Destination_Country","MX","Duty_Rate_Pct",3.0,"Tariff_Rate_Pct",15.0,"FTA","None"),
            MakeRow("Origin_Country","US","Destination_Country","MX","Duty_Rate_Pct",0.0,"Tariff_Rate_Pct",0.0,"FTA","USMCA"),
            MakeRow("Origin_Country","MX","Destination_Country","CN","Duty_Rate_Pct",3.0,"Tariff_Rate_Pct",5.0,"FTA","None"),
            MakeRow("Origin_Country","IN","Destination_Country","CN","Duty_Rate_Pct",3.5,"Tariff_Rate_Pct",4.0,"FTA","None"),
        });

        var financial = MakeRow(
            "Revenue_USD", 4_200_000_000.0,
            "EBITDA_Pct", 18.5,
            "DIO_Days", 48.0,
            "DSO_Days", 41.0,
            "DPO_Days", 36.0,
            "WACC_Pct", 8.5,
            "Carbon_Price_USD", 75.0,
            "FX_Hedge_Pct", 65.0
        );

        var contractRows = new List<object?>();
        foreach (var carrier in OceanCarriers.Concat(RoadCarriers).Concat(RailCarriers))
        {
            contractRows.Add(MakeRow(
                "Carrier", carrier,
                "Mode", OceanCarriers.Contains(carrier) ? "ocean" : RailCarriers.Contains(carrier) ? "rail" : "road",
                "Rate_Per_Shipment", (double)(1500 + rng.Next(0, 8000)),
                "Contract_Exit_USD", (double)(100_000 + rng.Next(0, 900_000)),
                "Contract_End_Year", 2025 + rng.Next(0, 3)
            ));
        }

        var skuRows = new List<object?>();
        var skuIdx = 1;
        foreach (var cat in Categories)
        {
            for (int k = 0; k < 5; k++)
            {
                skuRows.Add(MakeRow(
                    "SKU_ID", $"SKU-{skuIdx:D3}",
                    "SKU_Name", $"{cat} Type-{k + 1}",
                    "Product_Category", cat,
                    "Unit_Weight_KG", Math.Round(0.5 + rng.NextDouble() * 50.0, 1),
                    "Unit_Value_USD", Math.Round(5.0 + rng.NextDouble() * 500.0, 2)
                ));
                skuIdx++;
            }
        }

        // ── Packaging Master ────────────────────────────────────────────────
        var packagingRows = new List<object?>();
        var packagingDefs = new[]
        {
            ("Large washer-class",   0.94, 0.45, 0.14, 1.2,  0.10),
            ("Large cooling-class",  0.94, 0.55, 0.18, 1.8,  0.15),
            ("Medium HVAC-class",    0.94, 0.30, 0.10, 0.8,  0.08),
            ("Medium built-in-class",0.94, 0.28, 0.09, 0.7,  0.06),
            ("Small countertop-class",0.94, 0.12, 0.04, 0.3, 0.03),
        };
        foreach (var (cat, corrugate_kg, foam_kg, pallet_kg, ldpe_kg, steel_kg) in packagingDefs)
        {
            double embodied = corrugate_kg * 0.94 + foam_kg * 3.30 + pallet_kg * 0.46
                            + ldpe_kg * 2.10 + steel_kg * 2.50;
            packagingRows.Add(MakeRow(
                "Product_Family",   cat,
                "Corrugate_KG",     corrugate_kg,
                "EPS_Foam_KG",      foam_kg,
                "Wood_Pallet_KG",   pallet_kg,
                "LDPE_Wrap_KG",     ldpe_kg,
                "Steel_Strapping_KG", steel_kg,
                "Total_Packaging_KG", Math.Round(corrugate_kg + foam_kg + pallet_kg + ldpe_kg + steel_kg, 2),
                "Embodied_CO2e_KG", Math.Round(embodied, 3)
            ));
        }

        // ── Capacity Master ──────────────────────────────────────────────────
        var capacityRows = new List<object?>();
        var capacityDefs = new[]
        {
            ("Large washer-class",    62.0,  74.0,  0.53, 1.19, 150, 0.85, 40, "20ft"),
            ("Large cooling-class",   95.0, 112.0,  1.19, 1.18,  64, 0.85, 40, "40ft"),
            ("Medium HVAC-class",     48.0,  56.0,  0.35, 1.17, 280, 0.88, 40, "40ft"),
            ("Medium built-in-class", 45.0,  53.0,  0.36, 1.18, 190, 0.87, 40, "40ft"),
            ("Small countertop-class",16.0,  21.0,  0.11, 1.31,1100, 0.90, 40, "40ft"),
        };
        foreach (var (cat, bare_wt, pkg_wt, pkg_vol, load_factor, units_per_container, fill_pct, container_ft, container_type) in capacityDefs)
        {
            capacityRows.Add(MakeRow(
                "Product_Family",        cat,
                "Bare_Weight_KG",        bare_wt,
                "Packaged_Weight_KG",    pkg_wt,
                "Packaged_Volume_M3",    pkg_vol,
                "Load_Factor",           load_factor,
                "Units_Per_Container",   units_per_container,
                "Container_Fill_Pct",    fill_pct,
                "Container_Size_Ft",     container_ft,
                "Container_Type",        container_type,
                "Binding_Constraint",    "volume"
            ));
        }

        return new Dictionary<string, object?>
        {
            ["suppliers"]  = supplierRows.Cast<object?>().ToList(),
            ["plants"]     = plantRows.Cast<object?>().ToList(),
            ["dcs"]        = dcRows.Cast<object?>().ToList(),
            ["lanes"]      = laneRows.Cast<object?>().ToList(),
            ["nodes"]      = nodeRows.Cast<object?>().ToList(),
            ["categories"] = categoryRows.Cast<object?>().ToList(),
            ["trade"]      = tradeRows.Cast<object?>().ToList(),
            ["financial"]  = financial,
            ["contracts"]  = contractRows.Cast<object?>().ToList(),
            ["skus"]       = skuRows.Cast<object?>().ToList(),
            ["packaging"]  = packagingRows.Cast<object?>().ToList(),
            ["capacity"]   = capacityRows.Cast<object?>().ToList(),
        };
    }

    // ── lane row builder ────────────────────────────────────────────────────

    private static Row LaneRow(int id, Loc from, Loc to, string seg, string mode,
        double dist, double weight, int ships, double freight, int transit, double otif,
        string carrier, string cat)
    {
        return MakeRow(
            "Lane_ID", $"L-{id:D5}",
            "Origin", from.Name,
            "Destination", to.Name,
            "Segment", seg,
            "Mode", mode,
            "Distance_KM", Math.Round(dist, 0),
            "Freight_Cost_USD", Math.Round(freight, 0),
            "Shipments_Per_Year", ships,
            "Avg_Weight_KG", Math.Round(weight, 0),
            "Transit_Time_Days", transit,
            "OTIF_Pct", otif,
            "Carrier", carrier,
            "Product_Category", cat,
            "Origin_Country", from.Country,
            "Destination_Country", to.Country,
            "Origin_Lat", from.Lat,
            "Origin_Lng", from.Lng,
            "Dest_Lat", to.Lat,
            "Dest_Lng", to.Lng
        );
    }

    // ── physics helpers ─────────────────────────────────────────────────────

    private static double Haversine(double lat1, double lng1, double lat2, double lng2)
    {
        const double R = 6371.0;
        double dLat = (lat2 - lat1) * Math.PI / 180.0;
        double dLng = (lng2 - lng1) * Math.PI / 180.0;
        double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
                 + Math.Cos(lat1 * Math.PI / 180.0) * Math.Cos(lat2 * Math.PI / 180.0)
                 * Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
        return R * 2.0 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1.0 - a));
    }

    private static double FreightPerShipment(Random rng, string mode, double dist, double weight)
    {
        double wt = weight / 1000.0;
        double var = 0.85 + rng.NextDouble() * 0.30;
        return mode switch
        {
            "ocean" => Math.Max(800, (1800 + dist * wt * 0.010) * var),
            "rail"  => Math.Max(600, (700 + dist * wt * 0.022) * var),
            "air"   => Math.Max(1500, (2800 + dist * wt * 1.40) * var),
            _       => Math.Max(300, (420 + dist * wt * 0.065) * var),
        };
    }

    private static int TransitDays(Random rng, string mode, double dist)
    {
        int base_ = mode switch
        {
            "ocean" => (int)(dist / 820.0 + 3),
            "rail"  => (int)(dist / 620.0 + 2),
            "air"   => (int)(dist / 8000.0 + 1),
            _       => (int)(dist / 480.0 + 1),
        };
        return Math.Max(1, base_ + rng.Next(-1, 2));
    }

    private static double OtifPct(Random rng, string mode)
    {
        var (lo, hi) = mode switch
        {
            "ocean" => (87.0, 96.5),
            "rail"  => (90.0, 97.5),
            "air"   => (95.0, 99.5),
            _       => (92.0, 99.5),
        };
        return Math.Round(lo + rng.NextDouble() * (hi - lo), 1);
    }

    private static int ShipsPerYear(Random rng, string seg)
    {
        return seg switch
        {
            "Supplier→Port" => 12 + rng.Next(0, 100),
            "Port→Plant"    => 18 + rng.Next(0, 80),
            "Supplier→Plant"=> 12 + rng.Next(0, 60),
            "Plant→Plant"   => 24 + rng.Next(0, 80),
            "Plant→DC"      => 52 + rng.Next(0, 200),
            "DC→DC"         => 24 + rng.Next(0, 80),
            _                    => 26,
        };
    }

    private static string CarrierFor(Random rng, string mode)
    {
        return mode switch
        {
            "ocean" => Pick(rng, OceanCarriers),
            "rail"  => Pick(rng, RailCarriers),
            "air"   => Pick(rng, AirCarriers),
            _       => Pick(rng, RoadCarriers),
        };
    }

    // ── utility ─────────────────────────────────────────────────────────────

    private static T Pick<T>(Random rng, T[] arr) => arr[rng.Next(arr.Length)];

    private static T[] PickN<T>(Random rng, T[] arr, int n)
        => arr.OrderBy(_ => rng.Next()).Take(Math.Min(n, arr.Length)).ToArray();

    private static Row MakeRow(params object[] kv)
    {
        var row = new Row();
        for (int i = 0; i + 1 < kv.Length; i += 2)
            row[(string)kv[i]] = kv[i + 1];
        return row;
    }
}
