/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    // Расчет выручки от операции
    const { discount, sale_price, quantity } = purchase;
    const dis =  1 - (discount / 100);
    return sale_price * dis * quantity;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    // Расчет бонуса от позиции в рейтинге
    const { profit } = seller;
    if (index === 0) {
        return profit * 0.15;
    } else if (index === 1 || index === 2) {
        return profit * 0.10;
    } else if (index === total - 1) {
        return 0;
    } else { // Для всех остальных
        return profit * 0.05;
    }
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    const { calculateRevenue, calculateBonus } = options; // Сюда передадим функции для расчётов
    // Проверка входных данных
    if (!data
        || !Array.isArray(data.customers)
        || !Array.isArray(data.products)
        || !Array.isArray(data.sellers)
        || !Array.isArray(data.purchase_records)
        || data.customers.length === 0
        || data.products.length === 0
        || data.sellers.length === 0
        || data.purchase_records.length === 0) {
        throw new Error('Некорректные входные данные');
    }

    // Проверка наличия опций
    if (!calculateRevenue || !calculateBonus) {
        throw new Error('Некорректные опции');
    }

    // Подготовка промежуточных данных для сбора статистики
    // Заполним начальными данными
    const sellerStats = data.sellers.map(seller => (
        {
            id: seller.id,
            name: `${seller.first_name} ${seller.last_name}`,
            revenue: 0,
            profit: 0,
            sales_count: 0,
            products_sold: {},
        }
    ));

    // Индексация продавцов и товаров для быстрого доступа
    const sellerIndex = sellerStats.reduce((result, item) => ({ ...result, [item.id]: item }), {});
    const productIndex = data.products.reduce((result, item) => ({ ...result, [item.sku]: item }), {});

    // Расчет выручки и прибыли для каждого продавца
    data.purchase_records.forEach(record => { // Чек 
        const seller = sellerIndex[record.seller_id]; // Продавец
        // Увеличить количество продаж 
        seller.sales_count++;
        // Увеличить общую сумму выручки всех продаж
        seller.revenue += record.total_amount;
        const sumPurchase = record.items.reduce((a, v) => a + v.sale_price, 0);
        // Расчёт прибыли для каждого товара
        record.items.forEach(item => {
            const product = productIndex[item.sku]; // Товар

            // Посчитать себестоимость (cost) товара как product.purchase_price, умноженную на количество товаров из чека
            const cost = product.purchase_price * item.quantity;

            // Посчитать выручку (revenue) с учётом скидки через функцию calculateRevenue
            const revenue = calculateRevenue({ discount: item.discount, sale_price: item.sale_price, quantity: item.quantity });

            // Посчитать прибыль: выручка минус себестоимость
            const profit = revenue - cost;

            // Увеличить общую накопленную прибыль (profit) у продавца  
            seller.profit += profit;

            // Учёт количества проданных товаров
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            // По артикулу товара увеличить его проданное количество у продавца
            seller.products_sold[item.sku] += item.quantity;
        });
    });
    // Сортировка продавцов по прибыли
    const sortedSellers = [...sellerStats].sort((a, b) => b.profit - a.profit);

    // Назначение премий на основе ранжирования
    sortedSellers.forEach((seller, index) => {
        seller.bonus = calculateBonus(index, sortedSellers.length, seller);
        seller.top_products =
            Object.entries(seller.products_sold)
                .map(([sku, quantity]) => ({ sku, quantity }))
                .sort((a, b) => (b.quantity - a.quantity))
                .slice(0, 10);
    });

    // Подготовка итоговой коллекции с нужными полями
    return sortedSellers.map(seller => ({
        seller_id: seller.id,
        name: seller.name,
        revenue: +seller.revenue.toFixed(2),
        profit: +seller.profit.toFixed(2),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: +seller.bonus.toFixed(2),
    }));
}