namespace LogiTrack.Api.Core;

/// <summary>
/// A faithful port of CPython's <c>random.Random</c> (MT19937 core + the exact
/// algorithms CPython uses for <c>random()</c>, <c>gauss()</c>, and <c>uniform()</c>).
///
/// This makes the Monte Carlo NPV simulation in the C# backend reproduce the same
/// sequence as the Python backend when seeded identically (seed = 11), so results
/// match number-for-number rather than only statistically.
/// </summary>
public sealed class PyRandom
{
    private const int N = 624;
    private const int M = 397;
    private const uint MatrixA = 0x9908b0df;
    private const uint UpperMask = 0x80000000;
    private const uint LowerMask = 0x7fffffff;

    private readonly uint[] _mt = new uint[N];
    private int _mti = N + 1;

    // gauss() keeps a spare value between calls (CPython behaviour)
    private double? _gaussNext;

    public PyRandom(ulong seed)
    {
        SeedFromInt(seed);
    }

    // --- CPython init_by_array seeding (random.seed(int)) ---
    private void InitGenrand(uint s)
    {
        _mt[0] = s;
        for (_mti = 1; _mti < N; _mti++)
            _mt[_mti] = (uint)(1812433253u * (_mt[_mti - 1] ^ (_mt[_mti - 1] >> 30)) + (uint)_mti);
    }

    private void InitByArray(uint[] initKey)
    {
        InitGenrand(19650218u);
        int i = 1, j = 0;
        int k = Math.Max(N, initKey.Length);
        for (; k > 0; k--)
        {
            _mt[i] = (uint)((_mt[i] ^ ((_mt[i - 1] ^ (_mt[i - 1] >> 30)) * 1664525u)) + initKey[j] + (uint)j);
            i++; j++;
            if (i >= N) { _mt[0] = _mt[N - 1]; i = 1; }
            if (j >= initKey.Length) j = 0;
        }
        for (k = N - 1; k > 0; k--)
        {
            _mt[i] = (uint)((_mt[i] ^ ((_mt[i - 1] ^ (_mt[i - 1] >> 30)) * 1566083941u)) - (uint)i);
            i++;
            if (i >= N) { _mt[0] = _mt[N - 1]; i = 1; }
        }
        _mt[0] = 0x80000000u;
    }

    private void SeedFromInt(ulong seed)
    {
        // CPython converts the int seed into an array of 32-bit words (little-endian).
        if (seed == 0)
        {
            InitByArray(new uint[] { 0u });
            return;
        }
        var key = new List<uint>();
        ulong s = seed;
        while (s > 0)
        {
            key.Add((uint)(s & 0xffffffff));
            s >>= 32;
        }
        InitByArray(key.ToArray());
    }

    private uint GenrandUint32()
    {
        uint y;
        if (_mti >= N)
        {
            int kk;
            for (kk = 0; kk < N - M; kk++)
            {
                y = (_mt[kk] & UpperMask) | (_mt[kk + 1] & LowerMask);
                _mt[kk] = _mt[kk + M] ^ (y >> 1) ^ ((y & 1) != 0 ? MatrixA : 0u);
            }
            for (; kk < N - 1; kk++)
            {
                y = (_mt[kk] & UpperMask) | (_mt[kk + 1] & LowerMask);
                _mt[kk] = _mt[kk + (M - N)] ^ (y >> 1) ^ ((y & 1) != 0 ? MatrixA : 0u);
            }
            y = (_mt[N - 1] & UpperMask) | (_mt[0] & LowerMask);
            _mt[N - 1] = _mt[M - 1] ^ (y >> 1) ^ ((y & 1) != 0 ? MatrixA : 0u);
            _mti = 0;
        }
        y = _mt[_mti++];
        y ^= y >> 11;
        y ^= (y << 7) & 0x9d2c5680;
        y ^= (y << 15) & 0xefc60000;
        y ^= y >> 18;
        return y;
    }

    /// <summary>random() - 53-bit resolution float in [0, 1), exactly as CPython.</summary>
    public double NextDouble()
    {
        uint a = GenrandUint32() >> 5; // 27 bits
        uint b = GenrandUint32() >> 6; // 26 bits
        return (a * 67108864.0 + b) * (1.0 / 9007199254740992.0);
    }

    /// <summary>uniform(a, b) == a + (b - a) * random().</summary>
    public double Uniform(double a, double b) => a + (b - a) * NextDouble();

    /// <summary>randint(a, b) - inclusive integer in [a, b] like CPython.</summary>
    public int RandInt(int a, int b) => a + (int)(NextDouble() * (b - a + 1));

    /// <summary>
    /// gauss(mu, sigma) - CPython's algorithm (cached spare via cos/sin of a shared radius).
    /// </summary>
    public double Gauss(double mu, double sigma)
    {
        double z;
        var spare = _gaussNext;
        _gaussNext = null;
        if (spare is null)
        {
            double x2pi = NextDouble() * 2.0 * Math.PI;
            double g2rad = Math.Sqrt(-2.0 * Math.Log(1.0 - NextDouble()));
            z = Math.Cos(x2pi) * g2rad;
            _gaussNext = Math.Sin(x2pi) * g2rad;
        }
        else
        {
            z = spare.Value;
        }
        return mu + z * sigma;
    }
}
