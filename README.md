# api-nodejs-mngr-rest

## Software Architecture

The `api-nodejs-mngr-rest` is designed leveraging the principles of Hexagonal Architecture to ensure a clean separation of concerns, making it more adaptable to changes and easier to test. This architecture divides the application into several layers, each with its own responsibility.

- **Adapters Layer**: Located within the `adapters` directory, this layer contains the controllers and presentation logic. It acts as the bridge between the external world and our application, converting external requests into a format that the application can understand.

- **Application Layer**: This is the heart of our business logic. Here, we define the services that execute operations related to our business rules. It's crafted to be independent of any external interfaces, ensuring that core functionality can evolve independently of external changes.

- **Infrastructure / Server Layer**: Found in the `infrastructure` directory, this layer manages the technical details and configurations necessary for running our application. It includes server configurations and external integrations, abstracting the complexities of external communications from the core logic of the application.

- **Domain Layer**: The domain layer hosts our data interfaces and repositories. Located in the `domain` directory, it defines the business entities and the contracts for data access, ensuring that the application can interact with data sources in a consistent manner.

- **Bin Layer**: The initialization of the server is handled in the `bin` layer. It's responsible for bootstrapping the application, setting up the necessary configurations for the application to run.

For integration and continuous deployment, the API utilizes a `config.ts` file for environment variables, facilitating seamless integration with CI/CD pipelines. This approach not only enhances the maintainability and scalability of the application but also streamlines the deployment process, ensuring that the application can be easily integrated into various environments with minimal configuration changes.

In summary, the `api-nodejs-mngr-rest` is structured to promote flexibility, maintainability, and scalability, adhering to best practices in software architecture. It's an ideal starting point for building Node.js APIs that require a robust structure for long-term evolution and integration.

## Repository Purpose

The primary aim of this repository is to maintain the Node.js API Manager template. This template is designed to provide a solid foundation for building Node.js APIs, incorporating principles of Hexagonal Architecture for clean separation of concerns and adaptability to change.

## Installation

Follow these steps to get the application up and running on your local machine (bash):

1. **Clone the Repository**: Start by cloning this repository to your local environment. Use the command: `git clone <repository-url>`
2. **Install Dependencies**: Navigate to the root folder of the project and install the necessary dependencies by running: `npm install`
3. **Run the Application**: For Linux systems, you can start the application by executing: `npm run dev`

For further information, look at the `package.json` file at the root of the project.

## Making API Requests

Currently, the API provides a single endpoint that supports the POST HTTP method. To interact with this endpoint, you can use the following cURL command:

```cURL
curl --location 'http://localhost:9080/v1/product/tax' \
--header 'X-RqUID: 12345' \
--header 'X-Name: API node js challenge 2' \
--header 'Content-Type: application/json' \
--data '{
    "id": "string",
    "amount": 100000,
    "idClient": "string",
    "email": "string"
}'

## Members

- Andrés Felipe Wilches Torres
