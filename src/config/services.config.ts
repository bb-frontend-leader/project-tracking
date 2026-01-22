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
        name: 'VIMEP 2025',
        url: 'https://demos.booksandbooksdigital.com.co/12-vimep-2025/',
        contentValidation: {
            checkForApacheIndex: true
        }
    },
    {
        name: 'VIMEP 2023',
        url: 'https://demos.booksandbooksdigital.com.co/vimep-2023/',
        contentValidation: {
            checkForApacheIndex: true
        }
    },
    {
        name: 'Simuladores 2023',
        url: 'https://demos.booksandbooksdigital.com.co/simuladores-2023/',
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
