// Mock下载API
export default function handler(req, res) {
    if (req.method === 'GET') {
        const { filename } = req.query;
        
        let content, contentType;
        
        if (filename.includes('.json')) {
            contentType = 'application/json';
            if (filename.includes('order')) {
                content = JSON.stringify({
                    orderId: 'ORD_' + Date.now(),
                    products: [
                        { name: '有机番茄', price: 6.5, quantity: 2, unit: '斤' }
                    ],
                    total: 13.0,
                    status: 'draft',
                    createdAt: new Date().toISOString()
                }, null, 2);
            } else if (filename.includes('listing')) {
                content = JSON.stringify({
                    productId: 'PROD_' + Date.now(),
                    name: '麻花鸡蛋',
                    price: 108,
                    stock: 100,
                    description: '农家散养，新鲜直达',
                    status: 'draft',
                    createdAt: new Date().toISOString()
                }, null, 2);
            }
        } else if (filename.includes('.md')) {
            contentType = 'text/markdown';
            content = `# ${filename}\n\n生成时间：${new Date().toLocaleString()}\n\n## 内容\n这是一个模拟的下载文件。\n\n## 备注\n文件通过Mock API生成。`;
        } else {
            contentType = 'text/plain';
            content = '文件内容';
        }
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(content);
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}