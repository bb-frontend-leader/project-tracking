/**
 * Services Configuration
 * 
 * Array of service definitions to be monitored by the system.
 * Each service can optionally include content validation rules.
 * 
 * Available validation options:
 * - checkForApacheIndex: Detects Apache directory listings (indicates missing site files)
 */
export const servicesConfig = [
    {
        name: 'REDG 2023',
        url: 'https://demos.booksandbooksdigital.com.co/ovas-doctorado-new/',
        contentValidation: {
            checkForApacheIndex: true
        }
    },
    {
        name: 'BOOKS 2025',
        url: 'https://demos.booksandbooksdigital.com.co/12-ovas-books/',
        contentValidation: {
            checkForApacheIndex: true
        }
    },
    {
        name: 'VIMEP 2023',
        url: 'https://demos.booksandbooksdigital.com.co/12-vimep-2023/',
        contentValidation: {
            checkForApacheIndex: true
        }
    },
    {
        name: 'VIMEP 2024',
        url: 'https://demos.booksandbooksdigital.com.co/12-vimep-2024/',
        contentValidation: {
            checkForApacheIndex: true
        }
    },
    {
        name: 'VIMEP 2025',
        url: 'https://demos.booksandbooksdigital.com.co/12-vimep-2025/',
        contentValidation: {
            checkForApacheIndex: true
        }
    },
    {
        name: '100 OVAS',
        url: 'https://demos.booksandbooksdigital.com.co/100-ovas/',
        contentValidation: {
            checkForApacheIndex: true
        }
    },
    {
        name: '120 OVAS',
        url: 'https://demos.booksandbooksdigital.com.co/120-ovas/',
        contentValidation: {
            checkForApacheIndex: true
        }
    },
    {
        name: '120 OVAS 2023',
        url: 'https://demos.booksandbooksdigital.com.co/120-ovas-2023/',
        contentValidation: {
            checkForApacheIndex: true
        }
    },
    {
        name: '200 OVAS 2025',
        url: 'https://demos.booksandbooksdigital.com.co/200-ovas-2025/',
        contentValidation: {
            checkForApacheIndex: true
        }
    }
    // Add more services here
    // Example:
    // {
    //     name: 'My Website',
    //     url: 'https://example.com',
    //     contentValidation: {
    //         checkForApacheIndex: true  // Detect Apache directory listings
    //     }
    // }
];
