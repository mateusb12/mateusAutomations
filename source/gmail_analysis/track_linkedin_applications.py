import json
from collections import Counter
from datetime import datetime, timedelta
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import sys


def load_data(filename):
    """Load the JSON file containing email data."""
    try:
        with open(filename, 'r', encoding='utf-8') as file:
            return json.load(file)
    except Exception as e:
        print(f"Error loading data: {e}")
        sys.exit(1)


def count_applications(data):
    """Count the number of application-related emails per day."""
    application_counts = Counter()
    date_format = "%A, %d %B %Y"

    for date_str, emails in data.items():
        try:
            date = datetime.strptime(date_str, date_format)
        except ValueError as e:
            print(f"Error parsing date '{date_str}': {e}")
            continue

        for email in emails:
            subject = email.get('Subject', '').lower()
            if 'your application was sent' in subject:
                application_counts[date] += 1

    return application_counts


def aggregate_counts(application_counts):
    """Aggregate counts per month, quarter, and year."""
    month_counts = Counter()
    quarter_counts = Counter()
    year_counts = Counter()

    for date, count in application_counts.items():
        # Month aggregation
        month_date = datetime(date.year, date.month, 1)
        month_counts[month_date] += count

        # Quarter aggregation
        q_num = (date.month - 1) // 3 + 1
        q_month = 3 * (q_num - 1) + 1
        quarter_date = datetime(date.year, q_month, 1)
        quarter_counts[quarter_date] += count

        # Year aggregation
        year_date = datetime(date.year, 1, 1)
        year_counts[year_date] += count

    return {
        'day': application_counts,
        'month': month_counts,
        'quarter': quarter_counts,
        'year': year_counts
    }


def determine_plot_data(counts_dicts, max_points):
    """Determine the appropriate aggregation level for plotting."""
    aggregation_levels = [
        ('day', counts_dicts['day'], mdates.DateFormatter('%d/%b'), mdates.DayLocator(), 45),
        ('month', counts_dicts['month'], mdates.DateFormatter('%b %Y'), mdates.MonthLocator(), 0),
        ('quarter', counts_dicts['quarter'], None, None, 0),
        ('year', counts_dicts['year'], None, None, 0),
    ]

    for level_name, counts, formatter, locator, rotation in aggregation_levels:
        if len(counts) <= max_points:
            sorted_counts = sorted(counts.items())
            labels = [item[0] for item in sorted_counts]
            values = [item[1] for item in sorted_counts]
            is_date = isinstance(labels[0], datetime)
            return labels, values, is_date, formatter, locator, rotation

    print("Data is too large to plot.")
    sys.exit(1)


def plot_data(x_labels, y_values, is_date, x_formatter, x_locator, x_rotation, bar_width=0.8):
    """
    Plot the application counts over time.

    Parameters:
    - x_labels: List of dates or categorical labels.
    - y_values: Corresponding counts.
    - is_date: Boolean indicating if x_labels are datetime objects.
    - x_formatter: DateFormatter for the x-axis.
    - x_locator: Locator for the x-axis.
    - x_rotation: Rotation angle for x-axis labels.
    - bar_width: Width of the bars (default is 0.8).
    """
    plt.figure(figsize=(10, 6))
    ax = plt.gca()
    ax.set_axisbelow(True)
    ax.grid(True, which='both', linestyle='--', linewidth=0.5, zorder=0)

    if is_date:
        # Calculate appropriate bar width based on the data frequency
        if isinstance(x_locator, mdates.DayLocator):
            # For daily data, set width as 0.8 days
            width = timedelta(days=0.8)
        elif isinstance(x_locator, mdates.MonthLocator):
            # For monthly data, set width as 15 days
            width = timedelta(days=15)
        else:
            # Default width for other cases
            width = timedelta(days=10)

        ax.bar(x_labels, y_values, width=width, edgecolor='black', zorder=1, align='center')
        if x_formatter:
            ax.xaxis.set_major_formatter(x_formatter)
        if x_locator:
            ax.xaxis.set_major_locator(x_locator)
        plt.xticks(rotation=x_rotation)
    else:
        x_positions = range(len(x_labels))
        ax.bar(x_positions, y_values, width=bar_width, edgecolor='black', zorder=1)
        ax.set_xticks(x_positions)
        # Format labels for quarters and years
        formatted_labels = [
            f'Q{((date.month - 1) // 3 + 1)} {date.year}' if date.month != 1 else str(date.year)
            for date in x_labels
        ]
        ax.set_xticklabels(formatted_labels, rotation=x_rotation)

    ax.yaxis.get_major_locator().set_params(integer=True)

    # Set labels and title
    plt.xlabel('Data')
    plt.ylabel('Número de vagas aplicadas')
    plt.title('Vagas aplicadas ao longo do tempo')
    plt.tight_layout()
    plt.show()


def main():
    filename = 'email_results_year.json'
    data = load_data(filename)
    application_counts = count_applications(data)

    if not application_counts:
        print("No application emails found.")
        sys.exit(0)

    counts_dicts = aggregate_counts(application_counts)
    max_points = 15  # Maximum number of data points on the x-axis

    x_labels, y_values, is_date, x_formatter, x_locator, x_rotation = determine_plot_data(counts_dicts, max_points)

    # Set the desired bar width here
    desired_bar_width = 0.8  # You can adjust this value as needed

    plot_data(x_labels, y_values, is_date, x_formatter, x_locator, x_rotation, bar_width=desired_bar_width)


if __name__ == '__main__':
    main()
