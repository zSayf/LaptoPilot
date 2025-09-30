import type { Country } from './types';

export const COUNTRIES: Country[] = [
    { name: "Australia", code: "AU", currency: "AUD", budgetMin: 800, budgetMax: 6000, budgetStep: 100 },
    { name: "Brazil", code: "BR", currency: "BRL", budgetMin: 2500, budgetMax: 20000, budgetStep: 500 },
    { name: "Canada", code: "CA", currency: "CAD", budgetMin: 600, budgetMax: 5000, budgetStep: 100 },
    { name: "Egypt", code: "EG", currency: "EGP", budgetMin: 10000, budgetMax: 80000, budgetStep: 1000 },
    { name: "France", code: "FR", currency: "EUR", budgetMin: 500, budgetMax: 4000, budgetStep: 100 },
    { name: "Germany", code: "DE", currency: "EUR", budgetMin: 500, budgetMax: 4000, budgetStep: 100 },
    { name: "India", code: "IN", currency: "INR", budgetMin: 30000, budgetMax: 250000, budgetStep: 5000 },
    { name: "Japan", code: "JP", currency: "JPY", budgetMin: 75000, budgetMax: 500000, budgetStep: 10000 },
    { name: "Saudi Arabia", code: "SA", currency: "SAR", budgetMin: 2000, budgetMax: 15000, budgetStep: 500 },
    { name: "United Arab Emirates", code: "AE", currency: "AED", budgetMin: 2000, budgetMax: 15000, budgetStep: 500 },
    { name: "United Kingdom", code: "GB", currency: "GBP", budgetMin: 400, budgetMax: 3500, budgetStep: 100 },
    { name: "United States", code: "US", currency: "USD", budgetMin: 500, budgetMax: 5000, budgetStep: 100 }
];
